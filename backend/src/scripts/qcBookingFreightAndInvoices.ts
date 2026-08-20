import { pool } from '../models/client'
import { calculateBookingWalletDebit } from '../utils/bookingWalletDebit'

type Severity = 'ERROR' | 'WARN'

type QcIssue = {
  scope: 'B2C' | 'B2B' | 'INVOICE'
  severity: Severity
  reference: string
  message: string
  expected?: number | string
  actual?: number | string
}

const BILLABLE_ORDER_STATUSES = [
  'shipment_created',
  'booked',
  'pickup_initiated',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'ndr',
  'rto',
  'rto_in_transit',
  'rto_delivered',
] as const

const FAILURE_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'manifest_failed', 'pending'])

const money = (value: unknown) => {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.round((parsed + Number.EPSILON) * 100) / 100
}

const nearlyEqual = (left: unknown, right: unknown, tolerance = 0.05) =>
  Math.abs(money(left) - money(right)) <= tolerance

const isCod = (value: unknown) => String(value || '').trim().toLowerCase() === 'cod'

const isBillable = (status: unknown) =>
  BILLABLE_ORDER_STATUSES.includes(String(status || '').trim().toLowerCase() as any)

const getArgValue = (name: string, fallback: string) => {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (direct) return direct.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  return fallback
}

const parseJson = <T = any>(value: unknown): T | null => {
  if (!value) return null
  if (typeof value === 'object') return value as T
  if (typeof value !== 'string') return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

const addIssue = (issues: QcIssue[], issue: QcIssue) => {
  issues.push(issue)
}

const qcB2COrders = async (issues: QcIssue[], since: Date, limit: number) => {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        user_id,
        order_number,
        order_type,
        order_status,
        freight_charges,
        other_charges,
        cod_charges,
        gst_percent,
        gst_amount,
        wallet_debit_amount,
        courier_cost,
        courier_partner,
        integration_type,
        awb_number,
        created_at
      FROM b2c_orders
      WHERE created_at >= $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [since, limit],
  )

  for (const order of rows) {
    const reference = String(order.order_number || order.id)
    const freight = money(order.freight_charges)
    const other = money(order.other_charges)
    const cod = money(order.cod_charges)
    const gstPercent = money(order.gst_percent)
    const gstAmount = money(order.gst_amount)
    const walletDebit = money(order.wallet_debit_amount)
    const status = String(order.order_status || '').toLowerCase()

    if (isBillable(status) && freight <= 0) {
      addIssue(issues, {
        scope: 'B2C',
        severity: 'ERROR',
        reference,
        message: 'Billable B2C order has zero freight_charges.',
        actual: freight,
      })
    }

    if (isCod(order.order_type) && isBillable(status) && cod <= 0) {
      addIssue(issues, {
        scope: 'B2C',
        severity: 'WARN',
        reference,
        message: 'COD B2C order is billable but cod_charges is zero.',
        actual: cod,
      })
    }

    if (FAILURE_STATUSES.has(status) && walletDebit > 0) {
      addIssue(issues, {
        scope: 'B2C',
        severity: 'WARN',
        reference,
        message: 'Non-billable/failed B2C order has a wallet debit amount; confirm refund/reversal.',
        actual: walletDebit,
      })
    }

    const expectedWallet = calculateBookingWalletDebit({
      paymentType: order.order_type,
      freightCharges: freight,
      otherCharges: other,
      codCharges: cod,
      gstPercent,
    })

    if (gstPercent > 0 && gstAmount > 0 && !nearlyEqual(gstAmount, expectedWallet.gstAmount)) {
      addIssue(issues, {
        scope: 'B2C',
        severity: 'ERROR',
        reference,
        message: 'Stored B2C gst_amount does not match freight + other + applicable COD GST.',
        expected: expectedWallet.gstAmount,
        actual: gstAmount,
      })
    }

    if (walletDebit > 0 && !nearlyEqual(walletDebit, expectedWallet.totalAmount)) {
      addIssue(issues, {
        scope: 'B2C',
        severity: 'ERROR',
        reference,
        message: 'Stored B2C wallet_debit_amount does not match freight + other + applicable COD + GST.',
        expected: expectedWallet.totalAmount,
        actual: walletDebit,
      })
    }
  }

  return rows.length
}

const qcB2BOrders = async (issues: QcIssue[], since: Date, limit: number) => {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        user_id,
        order_number,
        order_type,
        order_status,
        freight_charges,
        shipping_charges,
        cod_charges,
        courier_cost,
        charges_breakdown,
        provider_meta,
        courier_partner,
        integration_type,
        awb_number,
        provider_reference,
        provider_request_id,
        created_at
      FROM b2b_orders
      WHERE created_at >= $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [since, limit],
  )

  for (const order of rows) {
    const reference = String(order.order_number || order.id)
    const status = String(order.order_status || '').toLowerCase()
    const freight = money(order.freight_charges ?? order.shipping_charges)
    const cod = money(order.cod_charges)
    const courierCost = money(order.courier_cost)
    const chargesBreakdown = parseJson<{
      baseFreight?: number
      demurrage?: number
      total?: number
      overheads?: { amount?: number; name?: string; code?: string }[]
    }>(order.charges_breakdown)

    if (isBillable(status) && freight <= 0) {
      addIssue(issues, {
        scope: 'B2B',
        severity: 'ERROR',
        reference,
        message: 'Billable B2B order has zero freight_charges/shipping_charges.',
        actual: freight,
      })
    }

    if (isBillable(status) && !chargesBreakdown) {
      addIssue(issues, {
        scope: 'B2B',
        severity: 'ERROR',
        reference,
        message: 'Billable B2B order is missing charges_breakdown, so freight audit/invoice breakup is incomplete.',
      })
      continue
    }

    if (chargesBreakdown) {
      const baseFreight = money(chargesBreakdown.baseFreight)
      const demurrage = money(chargesBreakdown.demurrage)
      const overheads = Array.isArray(chargesBreakdown.overheads)
        ? chargesBreakdown.overheads.reduce((sum, charge) => sum + money(charge?.amount), 0)
        : 0
      const expectedTotal = money(baseFreight + demurrage + overheads)
      const breakdownTotal = money(chargesBreakdown.total)

      if (!nearlyEqual(breakdownTotal, expectedTotal)) {
        addIssue(issues, {
          scope: 'B2B',
          severity: 'ERROR',
          reference,
          message: 'B2B charges_breakdown.total does not equal baseFreight + demurrage + overheads.',
          expected: expectedTotal,
          actual: breakdownTotal,
        })
      }

      if (freight > 0 && breakdownTotal > 0 && !nearlyEqual(freight, breakdownTotal)) {
        addIssue(issues, {
          scope: 'B2B',
          severity: 'ERROR',
          reference,
          message: 'B2B stored freight_charges does not match charges_breakdown.total.',
          expected: breakdownTotal,
          actual: freight,
        })
      }
    }

    if (isCod(order.order_type) && isBillable(status) && cod <= 0) {
      addIssue(issues, {
        scope: 'B2B',
        severity: 'WARN',
        reference,
        message: 'COD B2B order is billable but cod_charges is zero.',
        actual: cod,
      })
    }

    if (courierCost < 0) {
      addIssue(issues, {
        scope: 'B2B',
        severity: 'ERROR',
        reference,
        message: 'B2B courier_cost is negative.',
        actual: courierCost,
      })
    }

    if (isBillable(status) && !String(order.awb_number || order.provider_reference || '').trim()) {
      addIssue(issues, {
        scope: 'B2B',
        severity: 'ERROR',
        reference,
        message: 'Billable B2B order has no AWB/provider reference.',
      })
    }
  }

  return rows.length
}

const qcInvoices = async (issues: QcIssue[], since: Date) => {
  const { rows: invoiceRows } = await pool.query(
    `
      SELECT
        id,
        invoice_no,
        seller_id,
        billing_start,
        billing_end,
        taxable_value,
        total_amount,
        order_numbers
      FROM "billingInvoices"
      WHERE created_at >= $1
      ORDER BY created_at DESC
      LIMIT 250
    `,
    [since],
  )

  const seenOrderInvoices = new Map<string, string>()
  for (const invoice of invoiceRows) {
    const reference = String(invoice.invoice_no || invoice.id)
    const orderNumbers = parseJson<string[]>(invoice.order_numbers) || []
    const invoiceOrderSet = new Set<string>()

    for (const rawOrderNumber of orderNumbers) {
      const orderNumber = String(rawOrderNumber || '').trim()
      if (!orderNumber) continue
      const key = `${invoice.seller_id}:${orderNumber}`

      if (invoiceOrderSet.has(orderNumber)) {
        addIssue(issues, {
          scope: 'INVOICE',
          severity: 'ERROR',
          reference,
          message: `Invoice contains duplicate order number ${orderNumber}.`,
        })
      }
      invoiceOrderSet.add(orderNumber)

      const previousInvoice = seenOrderInvoices.get(key)
      if (previousInvoice) {
        addIssue(issues, {
          scope: 'INVOICE',
          severity: 'ERROR',
          reference,
          message: `Order ${orderNumber} is present in more than one invoice for this seller.`,
          expected: `single invoice only`,
          actual: `${previousInvoice}, ${reference}`,
        })
      }
      seenOrderInvoices.set(key, reference)
    }
  }

  const { rows: invoiceSubtotalRows } = await pool.query(
    `
      WITH invoice_orders AS (
        SELECT
          bi.invoice_no,
          bi.seller_id,
          bi.taxable_value::numeric AS taxable_value,
          jsonb_array_elements_text(COALESCE(bi.order_numbers, '[]'::jsonb)) AS order_number
        FROM "billingInvoices" bi
        WHERE bi.created_at >= $1
      ),
      b2c_bill AS (
        SELECT
          io.invoice_no,
          io.taxable_value,
          COALESCE(o.freight_charges, o.shipping_charges, 0)::numeric
            + COALESCE(o.other_charges, 0)::numeric
            + COALESCE(o.cod_charges, 0)::numeric AS billed_amount
        FROM invoice_orders io
        JOIN b2c_orders o
          ON o.user_id = io.seller_id
         AND o.order_number = io.order_number
      ),
      b2b_bill AS (
        SELECT
          io.invoice_no,
          io.taxable_value,
          COALESCE(o.freight_charges, o.shipping_charges, 0)::numeric
            + COALESCE(o.cod_charges, 0)::numeric AS billed_amount
        FROM invoice_orders io
        JOIN b2b_orders o
          ON o.user_id = io.seller_id
         AND o.order_number = io.order_number
      )
      SELECT
        invoice_no,
        MAX(taxable_value) AS taxable_value,
        SUM(billed_amount) AS recalculated_taxable_value
      FROM (
        SELECT * FROM b2c_bill
        UNION ALL
        SELECT * FROM b2b_bill
      ) bills
      GROUP BY invoice_no
    `,
    [since],
  )

  for (const row of invoiceSubtotalRows) {
    if (!nearlyEqual(row.taxable_value, row.recalculated_taxable_value)) {
      addIssue(issues, {
        scope: 'INVOICE',
        severity: 'WARN',
        reference: String(row.invoice_no),
        message:
          'Stored invoice taxable_value does not match the current freight + other + COD calculation for its stored orders.',
        expected: money(row.recalculated_taxable_value),
        actual: money(row.taxable_value),
      })
    }
  }

  return invoiceRows.length
}

async function main() {
  const days = Math.max(1, Number(getArgValue('--days', '90')) || 90)
  const limit = Math.max(1, Number(getArgValue('--limit', '500')) || 500)
  const strict = process.argv.includes('--strict')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const issues: QcIssue[] = []

  console.log('Booking freight/invoice QC started', {
    since: since.toISOString(),
    b2cLimit: limit,
    b2bLimit: limit,
    strict,
  })

  const [b2cChecked, b2bChecked, invoicesChecked] = await Promise.all([
    qcB2COrders(issues, since, limit),
    qcB2BOrders(issues, since, limit),
    qcInvoices(issues, since),
  ])

  const errors = issues.filter((issue) => issue.severity === 'ERROR')
  const warnings = issues.filter((issue) => issue.severity === 'WARN')

  console.log('Booking freight/invoice QC summary', {
    b2cChecked,
    b2bChecked,
    invoicesChecked,
    errors: errors.length,
    warnings: warnings.length,
  })

  for (const issue of issues.slice(0, 100)) {
    console.log(
      `[${issue.severity}] [${issue.scope}] ${issue.reference}: ${issue.message}`,
      issue.expected !== undefined || issue.actual !== undefined
        ? { expected: issue.expected, actual: issue.actual }
        : '',
    )
  }
  if (issues.length > 100) {
    console.log(`... ${issues.length - 100} more issue(s) omitted from console output.`)
  }

  console.log('Invoice counting logic checked by this QC', {
    orderTables: ['b2c_orders', 'b2b_orders'],
    dateField: 'created_at',
    sellerField: 'user_id / seller_id',
    billableStatuses: BILLABLE_ORDER_STATUSES,
    invoiceTaxableFormula: 'freight_charges + other_charges + COD charges',
    excludedFromBilling: ['transaction_fee', 'gift_wrap', 'discount'],
  })

  if (strict && errors.length > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error('Booking freight/invoice QC failed', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => undefined)
  })
