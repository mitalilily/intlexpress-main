import { and, eq, or } from 'drizzle-orm'
import { Response } from 'express'
import { db } from '../../models/client'
import { DelhiveryService } from '../../models/services/couriers/delhivery.service'
import { fetchAvailableCouriersWithRates } from '../../models/services/shiprocket.service'
import { b2c_orders } from '../../schema/schema'
import { getOpaqueProviderCode } from '../../utils/externalApiHelpers'
import { extractOrderAmountFromBody } from '../../utils/orderAmount'

const readShippingCostParams = (req: any) => (req.method === 'POST' ? req.body || {} : req.query || {})

const normalizeOptionalString = (value: unknown) => {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : undefined
}

const normalizeOptionalBoolean = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value

  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return null
}

const normalizeOptionalInteger = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  const normalized = Number(value)
  return Number.isFinite(normalized) ? Math.trunc(normalized) : NaN
}

const normalizePaymentType = (value: unknown) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')

  if (normalized === 'pre-paid' || normalized === 'prepaid') return 'Pre-paid'
  if (normalized === 'cod') return 'COD'
  return null
}

const normalizeShipmentStatus = (value: unknown) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (normalized === 'delivered') return 'Delivered'
  if (normalized === 'rto') return 'RTO'
  if (normalized === 'dto') return 'DTO'
  return null
}

const isSixDigitPincode = (value: number) => /^\d{6}$/.test(String(value))

const findMerchantDelhiveryOrderByWaybill = async (userId: string, waybill: string) => {
  const normalizedWaybill = String(waybill || '').trim()
  if (!normalizedWaybill) return null

  const [order] = await db
    .select()
    .from(b2c_orders)
    .where(
      and(
        eq(b2c_orders.user_id, userId),
        or(
          eq(b2c_orders.awb_number, normalizedWaybill),
          eq(b2c_orders.order_number, normalizedWaybill),
          eq(b2c_orders.provider_reference, normalizedWaybill),
          eq(b2c_orders.provider_request_id, normalizedWaybill),
        ),
      ),
    )
    .limit(1)

  return order || null
}

/**
 * Get shipping rates for a shipment
 * POST /api/v1/shipping/rates
 *
 * This endpoint calculates shipping rates without creating an order.
 * Use this to show shipping costs to customers before order creation.
 */
export const getShippingRatesController = async (req: any, res: Response) => {
  try {
    const userId = req.userId // From requireApiKey middleware
    const {
      destination,
      payment_type = 'prepaid',
      weight = 500,
      length = 10,
      breadth = 10,
      height = 10,
      shipment_type,
      pickup_id,
      is_reverse,
    } = req.body

    // Validate required fields
    if (!destination) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'destination pincode is required',
      })
    }

    // Get origin from user's primary pickup address if not provided
    // For now, we'll require origin or get it from pickup_id
    let origin: number | undefined

    if (pickup_id) {
      // If pickup_id is provided, we'll use it to get the origin pincode
      // The service will handle this internally
    } else {
      // Origin should be provided or will be fetched from user's primary pickup
      origin = req.body.origin ? Number(req.body.origin) : undefined
    }

    const orderAmountResult = extractOrderAmountFromBody(req.body)
    if (orderAmountResult.invalid) {
      return res.status(400).json({
        success: false,
        error: 'order_amount must be a non-negative number',
        message: 'order_amount must be numeric and non-negative',
      })
    }

    // Build serviceability options (no preferred carriers - return all)
    const serviceabilityOptions: any = { isCalculator: true }
    if (pickup_id) serviceabilityOptions.pickupId = pickup_id
    if (is_reverse === true || is_reverse === 'true') serviceabilityOptions.isReverse = true
    if (req.body.shadowfax_forward_mode ?? req.body.shadowfaxForwardMode) {
      serviceabilityOptions.shadowfax_forward_mode =
        req.body.shadowfax_forward_mode ?? req.body.shadowfaxForwardMode
    }
    if (req.body.shadowfax_service_mode ?? req.body.shadowfaxServiceMode) {
      serviceabilityOptions.shadowfax_service_mode =
        req.body.shadowfax_service_mode ?? req.body.shadowfaxServiceMode
    }

    // Fetch available couriers with rates (returns all available delivery carriers)
    const couriers = await fetchAvailableCouriersWithRates(
      {
        origin: origin || 0, // Will be determined from pickup address if not provided
        destination: Number(destination),
        payment_type: payment_type as 'cod' | 'prepaid' | 'reverse',
        order_amount: orderAmountResult.value,
        shipment_type:
          shipment_type && ['b2b', 'b2c'].includes(shipment_type)
            ? (shipment_type as 'b2b' | 'b2c')
            : undefined,
        weight: Number(weight),
        length: Number(length),
        breadth: Number(breadth),
        height: Number(height),
        ...serviceabilityOptions,
      },
      userId,
    )

    // Format response for shipping rates
    // Note: integration_type is intentionally excluded from external API responses
    const rates = (couriers ?? []).map((courier: any) => ({
      courier_option_key: courier.courier_option_key || null,
      courier_id: courier.id,
      courier_name: courier.displayName || courier.name,
      rate: courier.rate || courier.freight_charges || courier.charge || 0,
      chargeable_weight_g: courier.chargeable_weight ?? null,
      volumetric_weight_g: courier.volumetric_weight ?? null,
      slabs: courier.slabs ?? null,
      max_slab_weight: courier.max_slab_weight ?? null,
      estimated_delivery_days: courier.estimated_delivery_days || courier.tat || '3-5',
      estimated_delivery_date: courier.estimated_delivery_date,
      serviceable: courier.serviceable !== false,
      cod_available: courier.cod_available !== false,
      zone: courier.zone,
      provider_code: getOpaqueProviderCode(courier.integration_type),
    }))

    res.status(200).json({
      success: true,
      data: {
        rates,
        origin_pincode: origin,
        destination_pincode: destination,
        payment_type,
        weight_grams: weight,
        dimensions: {
          length,
          breadth,
          height,
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching shipping rates via API:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shipping rates',
      message: error.message || 'Internal server error',
    })
  }
}

/**
 * Calculate approximate Delhivery shipping charges for a shipment
 * GET|POST /api/v1/shipping/cost
 */
export const getDelhiveryShippingCostController = async (req: any, res: Response) => {
  try {
    const params = readShippingCostParams(req)
    const md = normalizeOptionalString(params.md)?.toUpperCase()
    const cgm = normalizeOptionalInteger(params.cgm)
    const originPincode = normalizeOptionalInteger(params.o_pin ?? params.origin ?? params.origin_pincode)
    const destinationPincode = normalizeOptionalInteger(
      params.d_pin ?? params.destination ?? params.destination_pincode,
    )
    const shipmentStatus = normalizeShipmentStatus(params.ss ?? params.status)
    const paymentType = normalizePaymentType(params.pt ?? params.payment_type)
    const length = normalizeOptionalInteger(params.l ?? params.length)
    const breadth = normalizeOptionalInteger(params.b ?? params.breadth)
    const height = normalizeOptionalInteger(params.h ?? params.height)
    const packageType = normalizeOptionalString(params.ipkg_type ?? params.package_type)
    const chargeableWeight = cgm ?? NaN
    const originPincodeValue = originPincode ?? NaN
    const destinationPincodeValue = destinationPincode ?? NaN

    if (!md || !['E', 'S'].includes(md)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid md',
        message: "md is required and must be 'E' (Express) or 'S' (Surface)",
      })
    }

    if (!Number.isFinite(chargeableWeight) || chargeableWeight < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cgm',
        message: 'cgm is required and must be a non-negative integer in grams',
      })
    }

    if (!Number.isFinite(originPincodeValue) || !isSixDigitPincode(originPincodeValue)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid o_pin',
        message: 'o_pin is required and must be a valid 6-digit origin pincode',
      })
    }

    if (
      !Number.isFinite(destinationPincodeValue) ||
      !isSixDigitPincode(destinationPincodeValue)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid d_pin',
        message: 'd_pin is required and must be a valid 6-digit destination pincode',
      })
    }

    if (!shipmentStatus) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ss',
        message: "ss is required and must be one of 'Delivered', 'RTO', or 'DTO'",
      })
    }

    if (!paymentType) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pt',
        message: "pt is required and must be 'Pre-paid' or 'COD'",
      })
    }

    for (const [key, value] of [
      ['l', length],
      ['b', breadth],
      ['h', height],
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        return res.status(400).json({
          success: false,
          error: `Invalid ${key}`,
          message: `${key} must be a positive integer when provided`,
        })
      }
    }

    const delhivery = new DelhiveryService()
    const data = await delhivery.calculateShippingCost({
      md: md as 'E' | 'S',
      cgm: chargeableWeight,
      o_pin: String(originPincodeValue),
      d_pin: String(destinationPincodeValue),
      ss: shipmentStatus,
      pt: paymentType,
      ...(length !== undefined ? { l: length } : {}),
      ...(breadth !== undefined ? { b: breadth } : {}),
      ...(height !== undefined ? { h: height } : {}),
      ...(packageType ? { ipkg_type: packageType } : {}),
    })

    return res.status(200).json({
      success: true,
      data,
      request: {
        provider: 'delhivery',
        md,
        cgm: chargeableWeight,
        o_pin: String(originPincodeValue),
        d_pin: String(destinationPincodeValue),
        ss: shipmentStatus,
        pt: paymentType,
        ...(length !== undefined ? { l: length } : {}),
        ...(breadth !== undefined ? { b: breadth } : {}),
        ...(height !== undefined ? { h: height } : {}),
        ...(packageType ? { ipkg_type: packageType } : {}),
      },
    })
  } catch (error: any) {
    console.error('Error calculating Delhivery shipping cost via API:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate shipping cost',
      message: error?.message || 'Internal server error',
    })
  }
}

/**
 * Generate a Delhivery provider shipping label against a waybill
 * GET|POST /api/v1/shipping/label
 */
export const getDelhiveryShippingLabelController = async (req: any, res: Response) => {
  try {
    const userId = String(req.userId || '').trim()
    const params = readShippingCostParams(req)
    const waybill = normalizeOptionalString(params.waybill ?? params.wbns ?? params.awb)
    const pdfPreference = normalizeOptionalBoolean(params.pdf)
    const pdf = pdfPreference ?? true
    const pdfSizeRaw = normalizeOptionalString(params.pdf_size ?? params.pdfSize)
    const pdfSize = pdfSizeRaw ? pdfSizeRaw.toUpperCase() : undefined

    if (!waybill) {
      return res.status(400).json({
        success: false,
        error: 'Missing waybill',
        message: 'waybill is required',
      })
    }

    if (pdfPreference === null) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pdf',
        message: 'pdf must be a boolean when provided',
      })
    }

    if (pdfSize && !['A4', '4R'].includes(pdfSize)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pdf_size',
        message: "pdf_size must be 'A4' or '4R' when provided",
      })
    }

    const order = userId ? await findMerchantDelhiveryOrderByWaybill(userId, waybill) : null
    const delhivery = new DelhiveryService({ order: order || undefined })

    if (pdf) {
      const labelPdf = await delhivery.generateLabel(waybill, {
        format: 'pdf',
        ...(pdfSize ? { pdfSize: pdfSize as 'A4' | '4R' } : {}),
      })

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `inline; filename="delhivery-label-${encodeURIComponent(waybill)}${pdfSize ? `-${pdfSize}` : ''}.pdf"`,
      )
      res.setHeader('X-Label-Provider', 'delhivery')
      if (pdfSize) {
        res.setHeader('X-Label-Pdf-Size', pdfSize)
      }

      return res.status(200).send(labelPdf)
    }

    const labelJson = await delhivery.generateLabel(waybill, {
      format: 'json',
      ...(pdfSize ? { pdfSize: pdfSize as 'A4' | '4R' } : {}),
    })

    return res.status(200).json({
      success: true,
      data: labelJson,
      request: {
        provider: 'delhivery',
        waybill,
        pdf: false,
        ...(pdfSize ? { pdf_size: pdfSize } : {}),
      },
    })
  } catch (error: any) {
    console.error('Error generating Delhivery shipping label via API:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate shipping label',
      message: error?.message || 'Internal server error',
    })
  }
}
