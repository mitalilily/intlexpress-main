const normalize = (value: unknown) => String(value ?? '').trim()

const parseRecord = (value: unknown): Record<string, any> => {
  if (!value) return {}

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return {}

    try {
      const parsed = JSON.parse(trimmed)
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

const isDelhiveryOrder = (order: Record<string, any>) => {
  const providerText = normalize(`${order.integration_type || ''} ${order.courier_partner || ''}`)
  return providerText.toLowerCase().includes('delhivery')
}

export const getDelhiveryBookedAccount = (order: Record<string, any>) => {
  if (!order || !isDelhiveryOrder(order)) return null

  const meta = parseRecord(order.provider_meta)
  const label =
    normalize(meta.delhivery_account_label) ||
    normalize(meta.delhiveryAccountLabel) ||
    normalize(meta?.delhivery_account?.accountLabel) ||
    normalize(meta?.delhiveryAccount?.accountLabel) ||
    normalize(meta?.booking_account?.label)
  const code =
    normalize(meta.delhivery_account_code) ||
    normalize(meta.delhiveryAccountCode) ||
    normalize(meta?.delhivery_account?.accountCode) ||
    normalize(meta?.delhiveryAccount?.accountCode) ||
    normalize(meta?.booking_account?.code)

  if (!label && !code) return null

  return {
    label: label || code,
    code: code || label,
  }
}
