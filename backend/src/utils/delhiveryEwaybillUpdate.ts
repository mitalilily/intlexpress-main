import { HttpError } from './classes'

const normalizeText = (value: unknown) => String(value ?? '').trim()

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

const SUPPORTED_EWAYBILL_KEYS = new Set(['dcn', 'ewbn'])
const SUPPORTED_SHIPMENT_EDIT_KEYS = new Set([
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

export const isDelhiveryEwaybillUpdateRequest = (payload: Record<string, any>) =>
  Object.prototype.hasOwnProperty.call(payload || {}, 'dcn') ||
  Object.prototype.hasOwnProperty.call(payload || {}, 'ewbn')

export const validateAndNormalizeDelhiveryEwaybillUpdate = ({
  order,
  payload,
}: {
  order: {
    awb_number?: string | null
  }
  payload: Record<string, any>
}) => {
  const providedKeys = Object.keys(payload || {}).filter(
    (key) => payload[key] !== undefined && payload[key] !== null && normalizeText(payload[key]) !== '',
  )
  const unsupportedKeys = providedKeys.filter(
    (key) => !SUPPORTED_EWAYBILL_KEYS.has(key) && !SUPPORTED_SHIPMENT_EDIT_KEYS.has(key),
  )
  if (unsupportedKeys.length > 0) {
    throw new HttpError(
      400,
      `Unsupported Delhivery provider update field(s): ${unsupportedKeys.join(', ')}.`,
    )
  }

  const includesShipmentEditKeys = providedKeys.some((key) => SUPPORTED_SHIPMENT_EDIT_KEYS.has(key))
  if (includesShipmentEditKeys) {
    throw new HttpError(
      400,
      'Do not mix E-waybill update fields with shipment edit fields in the same Delhivery update request.',
    )
  }

  const awb = normalizeText(order.awb_number)
  if (!awb) {
    throw new HttpError(400, 'Delhivery E-waybill update requires a waybill/AWB number.')
  }

  const dcn = normalizeText(payload.dcn)
  const ewbn = normalizeText(payload.ewbn)

  if (!dcn) {
    throw new HttpError(400, 'dcn is required for Delhivery E-waybill update.')
  }
  if (!ewbn) {
    throw new HttpError(400, 'ewbn is required for Delhivery E-waybill update.')
  }

  const providerPayload = { dcn, ewbn }
  const localOrderPatch: Record<string, any> = {
    invoice_number: dcn,
  }

  return {
    awb,
    providerPayload,
    localOrderPatch,
  }
}

export const isDelhiveryEwaybillUpdateAccepted = (response: any): boolean => {
  if (response === null || response === undefined) return false
  if (typeof response === 'object') {
    if (response.success === false || response.status === false) return false
    if (response.error || response.errors) return false
  }
  return true
}

export const buildDelhiveryEwaybillUpdateProviderMeta = ({
  existingMeta,
  requestPayload,
  response,
}: {
  existingMeta: unknown
  requestPayload: { dcn: string; ewbn: string }
  response: any
}) => {
  const meta = parseProviderMeta(existingMeta)
  return {
    ...meta,
    ewaybill_update: {
      provider: 'delhivery',
      request: requestPayload,
      response,
      updated_at: new Date().toISOString(),
    },
    invoice_number: requestPayload.dcn,
    ewbn: requestPayload.ewbn,
  }
}

