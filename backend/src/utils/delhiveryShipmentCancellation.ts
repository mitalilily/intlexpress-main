import { HttpError } from './classes'
import { mapLocalOrderTypeToDelhiveryPaymentMode } from './delhiveryShipmentUpdate'

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeStatusText = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const statusMatchesAny = (statuses: string[], candidates: string[]) =>
  statuses.some((status) =>
    candidates.some((candidate) => candidate.length > 0 && status.includes(candidate)),
  )

export const validateDelhiveryCancellationEligibility = (order: {
  awb_number?: string | null
  order_type?: string | null
  order_status?: string | null
  provider_last_status?: string | null
}) => {
  const awb = normalizeText(order.awb_number)
  if (!awb) {
    throw new HttpError(400, 'Delhivery cancellation requires a waybill/AWB number.')
  }

  const paymentMode = mapLocalOrderTypeToDelhiveryPaymentMode(order.order_type)
  if (!paymentMode) {
    throw new HttpError(
      400,
      'Current local payment mode could not be determined for this Delhivery shipment.',
    )
  }

  const normalizedStatuses = [
    normalizeStatusText(order.order_status),
    normalizeStatusText(order.provider_last_status),
  ].filter(Boolean)

  const forwardAllowedStates = ['pending', 'manifest', 'shipment_created', 'pickup_initiated', 'in_transit']
  const reverseAllowedStates = ['scheduled', 'pickup_initiated']
  const terminalStates = [
    'dispatched',
    'delivered',
    'dto',
    'rto',
    'lost',
    'closed',
    'cancelled',
    'canceled',
  ]

  if (statusMatchesAny(normalizedStatuses, terminalStates)) {
    throw new HttpError(
      400,
      'Delhivery cancellation is not allowed for dispatched or terminal shipment statuses.',
    )
  }

  const allowedStates = paymentMode === 'Pickup' ? reverseAllowedStates : forwardAllowedStates
  if (!statusMatchesAny(normalizedStatuses, allowedStates)) {
    const statusLabel = normalizeText(order.provider_last_status) || normalizeText(order.order_status) || 'unknown'
    const allowedLabel =
      paymentMode === 'Pickup'
        ? 'Scheduled'
        : 'Manifested, In Transit, or Pending'
    throw new HttpError(
      400,
      `Delhivery cancellation is allowed for ${paymentMode} shipments only when the shipment is in ${allowedLabel}. Current status: ${statusLabel}.`,
    )
  }

  return {
    awb,
    paymentMode,
  }
}

