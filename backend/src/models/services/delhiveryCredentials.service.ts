import { eq } from 'drizzle-orm'
import { db } from '../client'
import { courier_credentials } from '../schema/courierCredentials'

const DEFAULT_DELHIVERY_API_BASE = 'https://track.delhivery.com'
const DELHIVERY_ACCOUNT_CODES = ['account_1', 'account_2', 'account_3'] as const
const DELHIVERY_ACCOUNT_LABELS = [
  'Delhivery B2C Account',
  'Delhivery B2B Account',
  'Delhivery Backup Account',
] as const
export const HARDCODED_DELHIVERY_API_KEY =
  '7ebb0a19e281620bc670053bcde0c31746bc5f7f'

type DelhiveryAccountCode = (typeof DELHIVERY_ACCOUNT_CODES)[number]

export interface DelhiveryAccountConfig {
  accountCode: DelhiveryAccountCode
  accountLabel: string
  apiBase: string
  clientName: string
  apiKey: string
  username: string
  password: string
  b2bAuthToken: string
  b2bAuthTokenExpiresAt: string
  isActive: boolean
  isDefault: boolean
  pickupLocationIds: string[]
  pickupLocationNames: string[]
  isConfigured: boolean
}

export interface DelhiveryCredentials extends DelhiveryAccountConfig {}

export interface DelhiveryResolutionContext {
  preferredAccountCode?: string | null
  pickupLocationId?: string | null
  pickupLocationName?: string | null
  order?: Record<string, any> | null
}

const normalize = (value?: unknown) => String(value ?? '').trim()
const resolveDelhiveryApiKey = (...values: unknown[]) => {
  const hardcoded = normalize(HARDCODED_DELHIVERY_API_KEY)
  if (hardcoded) return hardcoded

  for (const value of values) {
    const normalized = normalize(value)
    if (normalized) return normalized
  }

  return ''
}

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

const normalizeStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalize(entry))
      .filter(Boolean)
      .filter((entry, index, source) => source.indexOf(entry) === index)
  }

  const text = normalize(value)
  if (!text) return []

  return text
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, source) => source.indexOf(entry) === index)
}

const buildEmptyAccount = (index: number): DelhiveryAccountConfig => ({
  accountCode: DELHIVERY_ACCOUNT_CODES[index],
  accountLabel: DELHIVERY_ACCOUNT_LABELS[index] || `Delhivery Account ${index + 1}`,
  apiBase: DEFAULT_DELHIVERY_API_BASE,
  clientName: '',
  apiKey: resolveDelhiveryApiKey(),
  username: '',
  password: '',
  b2bAuthToken: '',
  b2bAuthTokenExpiresAt: '',
  isActive: index === 0,
  isDefault: index === 0,
  pickupLocationIds: [],
  pickupLocationNames: [],
  isConfigured: Boolean(resolveDelhiveryApiKey()),
})

const maskApiKey = (value: string) =>
  value
    ? `${value.slice(0, 4)}${'*'.repeat(Math.max(value.length - 8, 0))}${value.slice(-4)}`
    : ''

const normalizeAccount = (
  rawValue: unknown,
  index: number,
  fallbackRow?: Partial<typeof courier_credentials.$inferSelect> | null,
): DelhiveryAccountConfig => {
  const raw = parseRecord(rawValue)
  const fallback = index === 0 ? fallbackRow : null
  const accountCode = DELHIVERY_ACCOUNT_CODES[index]
  const apiBase = normalize(raw.apiBase || fallback?.apiBase) || DEFAULT_DELHIVERY_API_BASE
  const clientName = normalize(raw.clientName || fallback?.clientName)
  const apiKey = resolveDelhiveryApiKey(raw.apiKey, fallback?.apiKey)
  const username = normalize(raw.username || fallback?.username)
  const password = normalize(raw.password || fallback?.password)
  const b2bAuthToken = normalize(raw.b2bAuthToken || raw.b2b_auth_token)
  const b2bAuthTokenExpiresAt = normalize(
    raw.b2bAuthTokenExpiresAt || raw.b2b_auth_token_expires_at,
  )
  const accountLabel =
    normalize(raw.accountLabel) || DELHIVERY_ACCOUNT_LABELS[index] || `Delhivery Account ${index + 1}`
  const isActive = raw.isActive === undefined ? index === 0 || Boolean(apiKey) : raw.isActive === true
  const isDefault = raw.isDefault === true
  const pickupLocationIds = normalizeStringArray(raw.pickupLocationIds || raw.pickup_location_ids)
  const pickupLocationNames = normalizeStringArray(
    raw.pickupLocationNames || raw.pickup_location_names,
  )

  return {
    accountCode,
    accountLabel,
    apiBase,
    clientName,
    apiKey,
    username,
    password,
    b2bAuthToken,
    b2bAuthTokenExpiresAt,
    isActive,
    isDefault,
    pickupLocationIds,
    pickupLocationNames,
    isConfigured: Boolean(apiKey),
  }
}

const normalizeAccounts = (
  row?: Partial<typeof courier_credentials.$inferSelect> | null,
): DelhiveryAccountConfig[] => {
  const metadata = parseRecord(row?.metadata)
  const rawAccounts = Array.isArray(metadata.delhiveryAccounts)
    ? metadata.delhiveryAccounts
    : Array.isArray(metadata.accounts)
      ? metadata.accounts
      : []

  const accounts = DELHIVERY_ACCOUNT_CODES.map((_, index) => {
    if (rawAccounts[index]) {
      return normalizeAccount(rawAccounts[index], index, row)
    }
    if (index === 0 && (normalize(row?.apiKey) || normalize(row?.clientName))) {
      return normalizeAccount({}, index, row)
    }
    return buildEmptyAccount(index)
  })

  let defaultAssigned = false
  const normalized = accounts.map((account, index) => {
    const shouldBeDefault =
      account.isDefault &&
      account.isActive &&
      (account.isConfigured || account.clientName || account.apiBase !== DEFAULT_DELHIVERY_API_BASE)

    if (shouldBeDefault && !defaultAssigned) {
      defaultAssigned = true
      return { ...account, isDefault: true }
    }

    return { ...account, isDefault: false }
  })

  if (!defaultAssigned) {
    const fallbackIndex = normalized.findIndex((account) => account.isActive && account.isConfigured)
    const finalIndex = fallbackIndex >= 0 ? fallbackIndex : 0
    normalized[finalIndex] = { ...normalized[finalIndex], isDefault: true }
  }

  return normalized
}

const readPreferredAccountCodeFromOrder = (order?: Record<string, any> | null) => {
  const meta = parseRecord(order?.provider_meta)

  return (
    normalize(meta.delhivery_account_code) ||
    normalize(meta.delhiveryAccountCode) ||
    normalize(meta?.delhivery_account?.accountCode) ||
    normalize(meta?.delhiveryAccount?.accountCode) ||
    normalize(meta?.booking_account?.code) ||
    ''
  )
}

const readPickupLocationNameFromOrder = (order?: Record<string, any> | null) => {
  const pickupDetails = parseRecord(order?.pickup_details)
  return (
    normalize(pickupDetails.warehouse_name) ||
    normalize(order?.pickup_location_name) ||
    normalize(order?.pickup_location_alias) ||
    normalize(order?.pickup_location) ||
    ''
  )
}

const matchesPickupLocation = (
  account: DelhiveryAccountConfig,
  pickupLocationId: string,
  pickupLocationName: string,
) => {
  if (!account.isActive || !account.isConfigured) return false

  if (pickupLocationId && account.pickupLocationIds.some((entry) => normalize(entry) === pickupLocationId)) {
    return true
  }

  const normalizedPickupLocationName = pickupLocationName.toLowerCase()
  if (
    normalizedPickupLocationName &&
    account.pickupLocationNames.some(
      (entry) => normalize(entry).toLowerCase() === normalizedPickupLocationName,
    )
  ) {
    return true
  }

  return false
}

export const serializeDelhiveryAccountsForMetadata = (accounts: DelhiveryAccountConfig[]) =>
  accounts.map((account) => ({
    accountCode: account.accountCode,
    accountLabel: account.accountLabel,
    apiBase: account.apiBase,
    clientName: account.clientName,
    apiKey: account.apiKey,
    username: account.username,
    password: account.password,
    b2bAuthToken: account.b2bAuthToken,
    b2bAuthTokenExpiresAt: account.b2bAuthTokenExpiresAt,
    isActive: account.isActive,
    isDefault: account.isDefault,
    pickupLocationIds: account.pickupLocationIds,
    pickupLocationNames: account.pickupLocationNames,
  }))

export const getDelhiveryAccounts = async (): Promise<DelhiveryAccountConfig[]> => {
  const [row] = await db
    .select({
      apiBase: courier_credentials.apiBase,
      clientName: courier_credentials.clientName,
      apiKey: courier_credentials.apiKey,
      username: courier_credentials.username,
      password: courier_credentials.password,
      metadata: courier_credentials.metadata,
    })
    .from(courier_credentials)
    .where(eq(courier_credentials.provider, 'delhivery'))
    .limit(1)

  return normalizeAccounts(row)
}

export const getDelhiveryCredentials = async (): Promise<DelhiveryCredentials> =>
  resolveDelhiveryCredentials()

export const persistDelhiveryAccountRuntimeDetails = async ({
  accountCode,
  clientName,
  pickupLocationId,
  pickupLocationName,
}: {
  accountCode: string
  clientName?: string | null
  pickupLocationId?: string | null
  pickupLocationName?: string | null
}) => {
  const normalizedAccountCode = normalize(accountCode)
  if (!normalizedAccountCode) return

  const [existingRow] = await db
    .select({
      apiBase: courier_credentials.apiBase,
      clientName: courier_credentials.clientName,
      apiKey: courier_credentials.apiKey,
      username: courier_credentials.username,
      password: courier_credentials.password,
      metadata: courier_credentials.metadata,
    })
    .from(courier_credentials)
    .where(eq(courier_credentials.provider, 'delhivery'))
    .limit(1)

  if (!existingRow) return

  const normalizedClientName = normalize(clientName)
  const normalizedPickupLocationId = normalize(pickupLocationId)
  const normalizedPickupLocationName = normalize(pickupLocationName)
  const accounts = normalizeAccounts(existingRow)

  const nextAccounts = accounts.map((account) => {
    if (account.accountCode !== normalizedAccountCode) {
      return account
    }

    const pickupLocationIds = Array.from(
      new Set(
        [...account.pickupLocationIds, normalizedPickupLocationId]
          .map((entry) => normalize(entry))
          .filter(Boolean),
      ),
    )
    const pickupLocationNames = Array.from(
      new Set(
        [...account.pickupLocationNames, normalizedPickupLocationName]
          .map((entry) => normalize(entry))
          .filter(Boolean),
      ),
    )

    return {
      ...account,
      clientName: normalizedClientName || account.clientName,
      pickupLocationIds,
      pickupLocationNames,
    }
  })

  const primaryAccount =
    nextAccounts.find((account) => account.isDefault) ||
    nextAccounts.find((account) => account.isActive && account.isConfigured) ||
    nextAccounts[0]

  const nextMetadata = {
    ...(existingRow.metadata && typeof existingRow.metadata === 'object' ? existingRow.metadata : {}),
    delhiveryAccounts: serializeDelhiveryAccountsForMetadata(nextAccounts),
    delhiveryAccountsVersion: 2,
  }

  await db
    .update(courier_credentials)
    .set({
      clientName: primaryAccount?.clientName || existingRow.clientName || '',
      metadata: nextMetadata,
      updatedAt: new Date(),
    })
    .where(eq(courier_credentials.provider, 'delhivery'))
}

export const resolveDelhiveryCredentials = async (
  context: DelhiveryResolutionContext = {},
): Promise<DelhiveryCredentials> => {
  const accounts = await getDelhiveryAccounts()
  const pickupLocationId =
    normalize(context.pickupLocationId) || normalize(context.order?.pickup_location_id)
  const pickupLocationName =
    normalize(context.pickupLocationName) || readPickupLocationNameFromOrder(context.order)
  const preferredAccountCode =
    normalize(context.preferredAccountCode) || readPreferredAccountCodeFromOrder(context.order)

  const configuredAccounts = accounts.filter((account) => account.isActive && account.isConfigured)

  let selectedAccount =
    configuredAccounts.find((account) => account.accountCode === preferredAccountCode) ||
    configuredAccounts.find((account) =>
      matchesPickupLocation(account, pickupLocationId, pickupLocationName),
    ) ||
    configuredAccounts.find((account) => account.isDefault) ||
    configuredAccounts[0] ||
    accounts.find((account) => account.isDefault) ||
    accounts[0]

  if (!selectedAccount) {
    selectedAccount = buildEmptyAccount(0)
  }

  return selectedAccount
}

export const maskDelhiveryApiKey = maskApiKey
export { DEFAULT_DELHIVERY_API_BASE, DELHIVERY_ACCOUNT_CODES }
