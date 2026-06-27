import { HttpError } from './classes'

export type DelhiveryShipmentUpdatePayload = {
  name?: string
  phone?: string | string[]
  pt?: string
  cod?: number
  add?: string
  products_desc?: string
  gm?: number
  shipment_height?: number
  shipment_width?: number
  shipment_length?: number
}

type SupportedDelhiveryPaymentMode = 'COD' | 'Prepaid' | 'Pickup' | 'REPL'

const SUPPORTED_EDIT_FIELDS = new Set([
  'name',
  'phone',
  'pt',
  'cod',
  'add',
  'products_desc',
  'gm',
  'shipment_height',
  'shipment_width',
  'shipment_length',
])

const DISPATCHED_OR_TERMINAL_STATUS_MARKERS = [
  'dispatched',
  'dto',
  'delivered',
  'rto',
  'lost',
  'closed',
  'cancelled',
  'canceled',
]

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeStatusText = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const parseProviderMeta = (value: unknown): Record<string, any> => {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {}
    } catch {
      return {}
    }
  }

  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {}
}

const normalizePhoneList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter(Boolean)
  }

  const text = normalizeText(value)
  if (!text) return []
  return [text]
}

const normalizePositiveNumber = (value: unknown, fieldLabel: string): number | undefined => {
  if (value === undefined || value === null || normalizeText(value) === '') return undefined
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new HttpError(400, `${fieldLabel} must be a positive number.`)
  }
  return numericValue
}

export const normalizeDelhiveryPaymentMode = (
  value: unknown,
): SupportedDelhiveryPaymentMode | null => {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[\s/_-]+/g, '')

  if (!normalized) return null
  if (normalized === 'cod') return 'COD'
  if (normalized === 'prepaid') {
    return 'Prepaid'
  }
  if (normalized === 'pickup' || normalized === 'rvp') return 'Pickup'
  if (normalized === 'repl' || normalized === 'replacement') return 'REPL'
  return null
}

export const mapLocalOrderTypeToDelhiveryPaymentMode = (
  value: unknown,
): SupportedDelhiveryPaymentMode | null => {
  const normalized = normalizeStatusText(value)
  if (normalized === 'cod') return 'COD'
  if (normalized === 'prepaid') return 'Prepaid'
  if (normalized === 'reverse' || normalized === 'pickup') return 'Pickup'
  if (normalized === 'replacement' || normalized === 'repl') return 'REPL'
  return null
}

const mapDelhiveryPaymentModeToLocalOrderType = (value: SupportedDelhiveryPaymentMode) => {
  if (value === 'COD') return 'cod'
  if (value === 'Prepaid') return 'prepaid'
  if (value === 'Pickup') return 'reverse'
  return 'replacement'
}

export const validateAndNormalizeDelhiveryShipmentUpdate = ({
  order,
  payload,
}: {
  order: {
    awb_number?: string | null
    order_type?: string | null
    order_status?: string | null
    provider_last_status?: string | null
  }
  payload: Record<string, any>
}) => {
  const providedKeys = Object.keys(payload || {}).filter(
    (key) => payload[key] !== undefined && payload[key] !== null && normalizeText(payload[key]) !== '',
  )

  if (!providedKeys.length) {
    throw new HttpError(400, 'Provide at least one editable shipment field.')
  }

  const unsupportedKeys = providedKeys.filter((key) => !SUPPORTED_EDIT_FIELDS.has(key))
  if (unsupportedKeys.length > 0) {
    throw new HttpError(
      400,
      `Unsupported Delhivery edit field(s): ${unsupportedKeys.join(', ')}.`,
    )
  }

  const awb = normalizeText(order.awb_number)
  if (!awb) {
    throw new HttpError(400, 'Delhivery shipment edit requires a waybill/AWB number.')
  }

  const statusTexts = [
    normalizeStatusText(order.order_status),
    normalizeStatusText(order.provider_last_status),
  ].filter(Boolean)
  if (
    statusTexts.some((status) =>
      DISPATCHED_OR_TERMINAL_STATUS_MARKERS.some((marker) => status.includes(marker)),
    )
  ) {
    throw new HttpError(
      400,
      'Shipment edit is not allowed for dispatched or terminal shipment statuses.',
    )
  }

  const currentPaymentMode = mapLocalOrderTypeToDelhiveryPaymentMode(order.order_type)
  const codAmount = normalizePositiveNumber(payload.cod, 'cod')
  const rawPtText = normalizeText(payload.pt).toLowerCase()
  const ptLooksLikeCodAndPrepaid =
    rawPtText.includes('cod') && (rawPtText.includes('pre') || rawPtText.includes('paid'))
  let requestedPaymentMode = Object.prototype.hasOwnProperty.call(payload, 'pt')
    ? normalizeDelhiveryPaymentMode(payload.pt)
    : null

  if (!requestedPaymentMode && ptLooksLikeCodAndPrepaid) {
    if (codAmount !== undefined) {
      requestedPaymentMode = 'COD'
    } else if (currentPaymentMode === 'COD') {
      requestedPaymentMode = 'Prepaid'
    } else if (currentPaymentMode === 'Prepaid') {
      requestedPaymentMode = 'COD'
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'pt') && !requestedPaymentMode) {
    throw new HttpError(
      400,
      'pt must be one of COD, Prepaid, Pickup, or REPL.',
    )
  }

  if (requestedPaymentMode) {
    if (!currentPaymentMode) {
      throw new HttpError(
        400,
        'Current local payment mode could not be determined for this shipment.',
      )
    }

    if (requestedPaymentMode === currentPaymentMode) {
      throw new HttpError(
        400,
        `${currentPaymentMode} to ${requestedPaymentMode} conversion is not allowed.`,
      )
    }

    const allowedTransitions = new Set(['COD->Prepaid', 'Prepaid->COD'])
    const transitionKey = `${currentPaymentMode}->${requestedPaymentMode}`
    if (!allowedTransitions.has(transitionKey)) {
      throw new HttpError(
        400,
        `${currentPaymentMode} to ${requestedPaymentMode} conversion is not allowed.`,
      )
    }
  }

  const name = normalizeText(payload.name) || undefined
  const add = normalizeText(payload.add) || undefined
  const productsDesc = normalizeText(payload.products_desc) || undefined
  const phoneList = normalizePhoneList(payload.phone)
  const weightGm = normalizePositiveNumber(payload.gm, 'gm')
  const shipmentHeight = normalizePositiveNumber(payload.shipment_height, 'shipment_height')
  const shipmentWidth = normalizePositiveNumber(payload.shipment_width, 'shipment_width')
  const shipmentLength = normalizePositiveNumber(payload.shipment_length, 'shipment_length')

  if (codAmount !== undefined) {
    const effectivePaymentMode = requestedPaymentMode || currentPaymentMode
    if (effectivePaymentMode !== 'COD') {
      throw new HttpError(
        400,
        'cod amount can only be updated when the shipment payment mode is COD.',
      )
    }
  }

  if (requestedPaymentMode === 'COD' && codAmount === undefined) {
    throw new HttpError(
      400,
      'Prepaid to COD conversion requires cod amount.',
    )
  }

  const providerPayload: DelhiveryShipmentUpdatePayload = {
    ...(name ? { name } : {}),
    ...(phoneList.length ? { phone: phoneList.length === 1 ? phoneList[0] : phoneList } : {}),
    ...(requestedPaymentMode ? { pt: requestedPaymentMode } : {}),
    ...(codAmount !== undefined ? { cod: codAmount } : {}),
    ...(add ? { add } : {}),
    ...(productsDesc ? { products_desc: productsDesc } : {}),
    ...(weightGm !== undefined ? { gm: weightGm } : {}),
    ...(shipmentHeight !== undefined ? { shipment_height: shipmentHeight } : {}),
    ...(shipmentWidth !== undefined ? { shipment_width: shipmentWidth } : {}),
    ...(shipmentLength !== undefined ? { shipment_length: shipmentLength } : {}),
  }

  const localOrderPatch: Record<string, any> = {}
  if (name) localOrderPatch.buyer_name = name
  if (phoneList.length) localOrderPatch.buyer_phone = phoneList[0]
  if (add) localOrderPatch.address = add
  if (weightGm !== undefined) localOrderPatch.weight = weightGm
  if (shipmentHeight !== undefined) localOrderPatch.height = shipmentHeight
  if (shipmentWidth !== undefined) localOrderPatch.breadth = shipmentWidth
  if (shipmentLength !== undefined) localOrderPatch.length = shipmentLength
  if (requestedPaymentMode) {
    localOrderPatch.order_type = mapDelhiveryPaymentModeToLocalOrderType(requestedPaymentMode)
  }
  if (codAmount !== undefined && (requestedPaymentMode === 'COD' || currentPaymentMode === 'COD')) {
    localOrderPatch.order_amount = codAmount
  }

  return {
    awb,
    currentPaymentMode,
    requestedPaymentMode,
    providerPayload,
    localOrderPatch,
  }
}

export const isDelhiveryShipmentUpdateAccepted = (response: any): boolean => {
  if (!response || typeof response !== 'object') return false
  if (response.success === false || response.status === false) return false
  if (response.error || response.errors) return false
  return true
}

export const buildDelhiveryShipmentUpdateProviderMeta = ({
  existingMeta,
  requestPayload,
  response,
}: {
  existingMeta: unknown
  requestPayload: DelhiveryShipmentUpdatePayload
  response: any
}) => {
  const meta = parseProviderMeta(existingMeta)
  return {
    ...meta,
    shipment_update: {
      provider: 'delhivery',
      request: requestPayload,
      response,
      updated_at: new Date().toISOString(),
    },
    ...(requestPayload.products_desc ? { products_desc: requestPayload.products_desc } : {}),
    ...(requestPayload.pt ? { payment_mode: requestPayload.pt } : {}),
    ...(requestPayload.cod !== undefined ? { cod_amount: requestPayload.cod } : {}),
  }
}
