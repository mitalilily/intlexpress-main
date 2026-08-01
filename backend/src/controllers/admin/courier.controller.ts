import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { Request, Response } from 'express'
import * as XLSX from 'xlsx'
import { db } from '../../models/client'
import {
  deleteCourierService,
  deleteShippingRate,
  getShippingRates,
  ShippingRateUpdatePayload,
  updateShippingRate,
} from '../../models/services/courierIntegration.service'
import {
  CSVRow,
  importB2CSlabFormat,
  importFlatFormat,
  isSlabValidationError,
  normalizeRateCardRow,
  parseRateCardCsvText,
} from '../../models/services/rateCardImport.service'
import {
  fetchAvailableCouriersWithRatesAdmin,
  fetchAvailableCouriersWithRatesB2B,
} from '../../models/services/shiprocket.service'
import { courier_credentials } from '../../models/schema/courierCredentials'
import { couriers } from '../../models/schema/couriers'
import { getAllZones } from '../../models/services/zone.service'
import { XpressbeesService } from '../../models/services/couriers/xpressbees.service'
import { ShadowfaxService } from '../../models/services/couriers/shadowfax.service'
import {
  createXpressbeesManualAwbRange,
  getXpressbeesManualAwbSummary,
} from '../../models/services/xpressbeesAwbRange.service'
import {
  AMAZON_CREDENTIALS_PROVIDER,
  AMAZON_DEFAULT_BUSINESS_ID,
  AMAZON_DEFAULT_REGION,
  applyAmazonShippingCredentialsToEnv,
  buildAmazonShippingCredentialsFromRow,
  maskAmazonCredential,
  normalizeAmazonCredentialTokens,
  normalizeAmazonCredentialValue,
  parseAmazonSandboxFlag,
} from '../../models/services/amazonShippingCredentials.service'
import {
  DEFAULT_DELHIVERY_API_BASE,
  DEFAULT_DELHIVERY_B2B_API_BASE,
  DELHIVERY_ACCOUNT_CODES,
  getDelhiveryAccounts,
  maskDelhiveryApiKey,
  serializeDelhiveryAccountsForMetadata,
  type DelhiveryAccountConfig,
} from '../../models/services/delhiveryCredentials.service'
import {
  generateDelhiveryB2BDocument,
  bookDelhiveryB2BAppointment,
  cancelDelhiveryB2BPickupRequest,
  createDelhiveryB2BPickupRequest,
  cancelDelhiveryB2BShipment,
  checkDelhiveryB2BServiceability,
  createDelhiveryB2BClientWarehouse,
  createDelhiveryB2BShipment,
  extractDelhiveryB2BJobId,
  estimateDelhiveryB2BFreight,
  estimateDelhiveryB2BTat,
  getDelhiveryB2BFreightCharges,
  getDelhiveryB2BLabelUrls,
  getDelhiveryB2BLrCopy,
  getDelhiveryB2BDocumentStatus,
  getDelhiveryB2BShipmentStatus,
  getDelhiveryB2BShipmentUpdateStatus,
  loginDelhiveryB2B,
  logoutDelhiveryB2B,
  trackDelhiveryB2BShipment,
  triggerDelhiveryForgotPassword,
  updateDelhiveryB2BClientWarehouse,
  updateDelhiveryB2BShipment,
} from '../../models/services/couriers/delhivery.service'

export interface ShippingRateFilters {
  courier_name?: string[]
  mode?: string
  min_weight?: number
  plan_id?: string
  business_type?: 'b2b' | 'b2c'
}

export const fetchAvailableCouriersForAdmin = async (req: Request, res: Response) => {
  try {
    const {
      origin,
      destination,
      payment_type,
      order_amount,
      weight,
      length,
      breadth,
      height,
      shipment_type,
      plan_id,
      isCalculator,
      context,
      shadowfax_forward_mode,
      shadowfaxForwardMode,
      shadowfax_service_mode,
      shadowfaxServiceMode,
    } = req.body
    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'pickupPincode and deliveryPincode are required',
      })
    }

    const serviceabilityParams = {
      origin: Number(origin),
      destination: Number(destination),
      payment_type: payment_type,
      order_amount: order_amount,
      shipment_type: shipment_type,
      weight: Number(weight),
      length: Number(length),
      breadth: Number(breadth),
      height: Number(height),
      isCalculator: isCalculator === true || context === 'rate_calculator',
      shadowfax_forward_mode: shadowfax_forward_mode ?? shadowfaxForwardMode,
      shadowfax_service_mode: shadowfax_service_mode ?? shadowfaxServiceMode,
    }

    const couriers =
      shipment_type === 'b2b'
        ? await fetchAvailableCouriersWithRatesB2B(serviceabilityParams, {
            planIdOverride: plan_id ?? null,
            planFallbackName: 'Basic',
          })
        : await fetchAvailableCouriersWithRatesAdmin(serviceabilityParams, plan_id)

    return res.json({ success: true, data: couriers ?? [] })
  } catch (err: any) {
    console.error('Error fetching couriers:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
}

export const getShippingRatesController = async (req: Request, res: Response) => {
  try {
    let courierNames: string[] = []

    const rawCourierNames = req.query['courier_name[]'] ?? req.query.courier_name

    if (Array.isArray(rawCourierNames)) {
      courierNames = rawCourierNames.flat().filter(Boolean).map(String)
    } else if (typeof rawCourierNames === 'string') {
      courierNames = [rawCourierNames]
    }

    const filters: ShippingRateFilters = {
      courier_name: courierNames.length ? courierNames : undefined,
      mode: req.query.mode as string | undefined,
      min_weight:
        (req.query.businessType as string | undefined)?.toLowerCase() === 'b2c'
          ? undefined
          : req.query.min_weight
            ? Number(req.query.min_weight)
            : undefined,
      plan_id: req.query.planId as string | undefined,
      business_type: (req.query.businessType as 'b2b' | 'b2c') || undefined,
    }

    const rates = await getShippingRates(filters)
    res.json({ success: true, data: rates })
  } catch (err) {
    console.error('Error fetching shipping rates:', err)
    res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}

export const getAllCouriersController = async (req: Request, res: Response) => {
  try {
    const courierList = await db
      .select({
        id: couriers.id,
        name: couriers.name,
        serviceProvider: couriers.serviceProvider,
        isEnabled: couriers.isEnabled,
        createdAt: couriers.createdAt,
      })
      .from(couriers)
      .orderBy(desc(couriers.createdAt))

    res.json({ success: true, data: courierList })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false })
  }
}

export const getAllCouriersListController = async (req: Request, res: Response) => {
  try {
    const { search, serviceProvider, businessType } = req.query

    const whereClauses = []

    // Filter by search (name or id)
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      whereClauses.push(
        or(
          ilike(couriers.name, searchTerm),
          sql`CAST(${couriers.id} AS TEXT) ILIKE ${searchTerm}`,
        )!,
      )
    }

    // Filter by service provider
    if (serviceProvider && typeof serviceProvider === 'string' && serviceProvider.trim()) {
      whereClauses.push(eq(couriers.serviceProvider, serviceProvider.trim()))
    }

    // Filter by business type (b2c or b2b)
    if (businessType && typeof businessType === 'string') {
      const normalizedBusinessType = businessType.trim().toLowerCase()
      if (normalizedBusinessType === 'b2c' || normalizedBusinessType === 'b2b') {
        // Construct JSONB array string - value is validated above (only 'b2c' or 'b2b')
        const jsonbArrayStr = JSON.stringify([normalizedBusinessType])
        // Match the pattern from shiprocket.service.ts - construct the full JSONB literal
        whereClauses.push(
          sql`${couriers.businessType} @> ${sql.raw(
            `'${jsonbArrayStr.replace(/'/g, "''")}'::jsonb`,
          )}`,
        )
      }
    }

    const whereCondition = whereClauses.length > 0 ? and(...whereClauses) : undefined

    const courierList = await db
      .select()
      .from(couriers)
      .where(whereCondition)
      .orderBy(desc(couriers.createdAt))

    res.json({ success: true, data: courierList })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to fetch couriers' })
  }
}

export const updateCourierStatusController = async (req: Request, res: Response) => {
  const { id } = req.params
  const { serviceProvider, isEnabled, businessType } = req.body

  try {
    if (!serviceProvider) {
      return res.status(400).json({
        success: false,
        message: 'serviceProvider is required',
      })
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    }

    // Update isEnabled if provided
    if (typeof isEnabled === 'boolean') {
      updateData.isEnabled = isEnabled
    }

    // Update businessType if provided
    if (businessType && Array.isArray(businessType) && businessType.length > 0) {
      // Validate businessType values
      const validTypes = businessType.filter((type) => type === 'b2c' || type === 'b2b')
      if (validTypes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'businessType must contain at least one valid value: "b2c" or "b2b"',
        })
      }
      updateData.businessType = validTypes
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 1) {
      // Only updatedAt was added, nothing to update
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update. Provide isEnabled and/or businessType',
      })
    }

    const updated = await db
      .update(couriers)
      .set(updateData)
      .where(and(eq(couriers.id, Number(id)), eq(couriers.serviceProvider, serviceProvider)))
      .returning()

    if (!updated.length) {
      return res.status(404).json({ success: false, message: 'Courier not found' })
    }

    res.json({ success: true, data: updated[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update courier' })
  }
}

export const getServiceProvidersController = async (req: Request, res: Response) => {
  try {
    // Only expose the main integrated service providers in the enable/disable UI
    const allowedProviders = ['delhivery', 'ekart', 'xpressbees', 'shadowfax', 'amazon']

    const rows = await db
      .select({
        serviceProvider: couriers.serviceProvider,
        totalCouriers: sql<number>`count(*)`,
        enabledCouriers: sql<number>`sum(case when ${couriers.isEnabled} then 1 else 0 end)`,
      })
      .from(couriers)
      .where(inArray(couriers.serviceProvider, allowedProviders))
      .groupBy(couriers.serviceProvider)
      .orderBy(couriers.serviceProvider)

    const byProvider = new Map(
      rows.map((row) => [
        row.serviceProvider,
        {
          serviceProvider: row.serviceProvider,
          totalCouriers: Number(row.totalCouriers || 0),
          enabledCouriers: Number(row.enabledCouriers || 0),
          isEnabled: Number(row.enabledCouriers || 0) > 0,
        },
      ]),
    )

    // Ensure allowed providers are always visible in admin UI,
    // even when no rows exist in couriers table yet.
    const providers = allowedProviders.map((provider) => ({
      serviceProvider: provider,
      totalCouriers: byProvider.get(provider)?.totalCouriers ?? 0,
      enabledCouriers: byProvider.get(provider)?.enabledCouriers ?? 0,
      isEnabled: byProvider.get(provider)?.isEnabled ?? false,
    }))

    res.json({ success: true, data: providers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to fetch service providers' })
  }
}

export const updateServiceProviderStatusController = async (req: Request, res: Response) => {
  const { serviceProvider } = req.params
  const { isEnabled } = req.body

  try {
    const allowedProviders = ['delhivery', 'ekart', 'xpressbees', 'shadowfax', 'amazon']

    if (!serviceProvider || typeof isEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'serviceProvider (param) and boolean isEnabled (body) are required',
      })
    }
    if (!allowedProviders.includes(String(serviceProvider).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Only these providers are supported: ${allowedProviders.join(', ')}`,
      })
    }

    const updated = await db
      .update(couriers)
      .set({
        isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(couriers.serviceProvider, serviceProvider))
      .returning()

    if (!updated.length) {
      return res.status(404).json({ success: false, message: 'No couriers found for provider' })
    }

    res.json({
      success: true,
      data: {
        serviceProvider,
        isEnabled,
        affectedCouriers: updated.length,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update service provider status' })
  }
}

const buildAmazonCredentialResponse = (
  row?: Partial<typeof courier_credentials.$inferSelect> | null,
) => {
  const credentials = buildAmazonShippingCredentialsFromRow(row)
  const accessToken = normalizeAmazonCredentialValue(credentials.accessToken)
  const refreshToken = normalizeAmazonCredentialValue(credentials.refreshToken)
  const lwaClientId = normalizeAmazonCredentialValue(credentials.lwaClientId)
  const lwaClientSecret = normalizeAmazonCredentialValue(credentials.lwaClientSecret)

  return {
    provider: AMAZON_CREDENTIALS_PROVIDER,
    apiBase: normalizeAmazonCredentialValue(credentials.endpoint),
    endpoint: normalizeAmazonCredentialValue(credentials.endpoint),
    lwaClientId,
    shippingBusinessId:
      normalizeAmazonCredentialValue(credentials.shippingBusinessId) || AMAZON_DEFAULT_BUSINESS_ID,
    region: normalizeAmazonCredentialValue(credentials.region) || AMAZON_DEFAULT_REGION,
    sandbox: Boolean(credentials.sandbox),
    lwaTokenUrl: normalizeAmazonCredentialValue(credentials.lwaTokenUrl),
    hasAccessToken: Boolean(accessToken),
    accessTokenMasked: maskAmazonCredential(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    refreshTokenMasked: maskAmazonCredential(refreshToken),
    hasLwaClientSecret: Boolean(lwaClientSecret),
    configured: Boolean(accessToken || (refreshToken && lwaClientId && lwaClientSecret)),
  }
}

const optionalCredentialString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : undefined

const normalizePublicUrl = (value: unknown, fallback: string) => {
  const normalized = String(value || fallback).trim()
  return normalized.replace(/\/+$/, '')
}

const getPublicApiUrl = () =>
  normalizePublicUrl(process.env.API_URL || process.env.PUBLIC_API_URL, 'https://api.intlexpress.in')

const resolvePublicWebhookUrl = (envName: string, path: string) => {
  const configured = optionalCredentialString(process.env[envName])
  if (configured) {
    return /^https?:\/\//i.test(configured)
      ? normalizePublicUrl(configured, configured)
      : `${getPublicApiUrl()}/${configured.replace(/^\/+/, '')}`
  }

  return `${getPublicApiUrl()}${path}`
}

const buildDelhiveryWebhookConfig = () => ({
  scanPushUrl: resolvePublicWebhookUrl(
    'DELHIVERY_SCAN_PUSH_WEBHOOK_URL',
    '/api/webhook/delhivery/scan',
  ),
  documentPushUrl: resolvePublicWebhookUrl(
    'DELHIVERY_DOCUMENT_PUSH_WEBHOOK_URL',
    '/api/webhook/delhivery/document',
  ),
  legacyUnifiedUrl: resolvePublicWebhookUrl(
    'DELHIVERY_LEGACY_WEBHOOK_URL',
    '/api/webhook/delhivery/order',
  ),
  method: 'POST',
  contentType: 'application/json',
  expectedResponse: '200 OK',
  requiredFields: [
    'Shipment.AWB',
    'Shipment.ReferenceNo',
    'Shipment.Status.Status',
    'Shipment.Status.StatusType',
    'Shipment.Status.Instructions',
    'Shipment.NSLCode or Shipment.Status.StatusCode',
  ],
})

const normalizeDelimitedStrings = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .filter((entry, index, source) => source.indexOf(entry) === index)
  }

  const normalized = String(value || '').trim()
  if (!normalized) return []

  return normalized
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, source) => source.indexOf(entry) === index)
}

const buildDelhiveryCredentialResponse = (accounts: DelhiveryAccountConfig[]) => ({
  provider: 'delhivery',
  webhookConfig: buildDelhiveryWebhookConfig(),
  accounts: accounts.map((account) => ({
    accountCode: account.accountCode,
    accountLabel: account.accountLabel,
    apiBase: account.apiBase || DEFAULT_DELHIVERY_API_BASE,
    clientName: account.clientName || '',
    username: account.username || '',
    hasApiKey: Boolean((account.apiKey || '').trim()),
    apiKeyMasked: maskDelhiveryApiKey(account.apiKey || ''),
    hasPassword: Boolean((account.password || '').trim()),
    passwordMasked: account.password ? '********' : '',
    hasB2BAuthToken: Boolean((account.b2bAuthToken || '').trim()),
    b2bAuthTokenExpiresAt: account.b2bAuthTokenExpiresAt || '',
    isActive: account.isActive === true,
    isDefault: account.isDefault === true,
    pickupLocationIds: account.pickupLocationIds || [],
    pickupLocationNames: account.pickupLocationNames || [],
  })),
})

const getDefaultDelhiveryAccountLabel = (index: number) => {
  if (index === 0) return 'Delhivery B2C Account'
  if (index === 1) return 'Delhivery B2B Account 1'
  if (index === 2) return 'Delhivery B2B Account 2'
  return `Delhivery Account ${index + 1}`
}

const LEGACY_DELHIVERY_ACCOUNT_LABELS_BY_INDEX: Record<number, Set<string>> = {
  1: new Set(['delhivery b2b account']),
  2: new Set(['delhivery backup account', 'delhivery backup credentials']),
}

const normalizeDelhiveryAccountLabel = (value: unknown, index: number) => {
  const normalized = String(value || '').trim()
  const legacyLabels = LEGACY_DELHIVERY_ACCOUNT_LABELS_BY_INDEX[index]

  if (!normalized || legacyLabels?.has(normalized.toLowerCase())) {
    return getDefaultDelhiveryAccountLabel(index)
  }

  return normalized
}

const isDelhiveryB2BAccountIndex = (index: number) => index > 0

const getDefaultDelhiveryAccountApiBase = (index: number) =>
  isDelhiveryB2BAccountIndex(index) ? DEFAULT_DELHIVERY_B2B_API_BASE : DEFAULT_DELHIVERY_API_BASE

const isDelhiveryAccountConfiguredForAdmin = (params: {
  index: number
  apiKey: string
  username: string
  password: string
  b2bAuthToken?: string
}) => {
  if (!isDelhiveryB2BAccountIndex(params.index)) {
    return Boolean(params.apiKey)
  }

  return Boolean(params.username && (params.password || params.b2bAuthToken))
}

const shouldAutoActivateDelhiveryAccount = (params: {
  index: number
  apiBase: string
  clientName: string
  username: string
  password: string
  b2bAuthToken: string
  pickupLocationIds: string[]
  pickupLocationNames: string[]
}) => {
  if (params.index === 0) return true

  return Boolean(
    params.username ||
      params.password ||
      params.b2bAuthToken ||
      params.clientName ||
      params.pickupLocationIds.length ||
      params.pickupLocationNames.length,
  )
}

const sanitizeDelhiveryAccountsPayload = (
  payloadAccounts: unknown,
  existingAccounts: DelhiveryAccountConfig[],
) => {
  const rawAccounts = Array.isArray(payloadAccounts) ? payloadAccounts : []

  const accounts = DELHIVERY_ACCOUNT_CODES.map((accountCode, index) => {
    const existing = existingAccounts[index]
    const raw = rawAccounts[index] && typeof rawAccounts[index] === 'object' ? rawAccounts[index] : {}
    const record = raw as Record<string, any>
    const nextApiKey = String(record.apiKey || '').trim()
    const nextUsername = String(record.username || '').trim()
    const nextPassword = String(record.password || '').trim()
    const usernameChanged = Boolean(nextUsername) && nextUsername !== (existing?.username || '')
    const passwordChanged = Boolean(nextPassword) && nextPassword !== (existing?.password || '')
    const apiBase =
      String(record.apiBase || '').trim() ||
      existing?.apiBase ||
      getDefaultDelhiveryAccountApiBase(index)
    const clientName = String(record.clientName || '').trim() || existing?.clientName || ''
    const pickupLocationIds = normalizeDelimitedStrings(
      record.pickupLocationIds ?? record.pickup_location_ids ?? existing?.pickupLocationIds,
    )
    const pickupLocationNames = normalizeDelimitedStrings(
      record.pickupLocationNames ??
        record.pickup_location_names ??
        existing?.pickupLocationNames,
    )
    const b2bAuthToken = usernameChanged || passwordChanged ? '' : existing?.b2bAuthToken || ''
    const b2bAuthTokenExpiresAt =
      usernameChanged || passwordChanged ? '' : existing?.b2bAuthTokenExpiresAt || ''
    const isActive =
      typeof record.isActive === 'boolean'
        ? record.isActive
        : shouldAutoActivateDelhiveryAccount({
            index,
            apiBase,
            clientName,
            username: nextUsername || existing?.username || '',
            password: nextPassword || existing?.password || '',
            b2bAuthToken,
            pickupLocationIds,
            pickupLocationNames,
          })

    return {
      accountCode,
      accountLabel: normalizeDelhiveryAccountLabel(record.accountLabel || existing?.accountLabel, index),
      apiBase,
      clientName,
      username: nextUsername || existing?.username || '',
      apiKey: nextApiKey || existing?.apiKey || '',
      password: nextPassword || existing?.password || '',
      b2bAuthToken,
      b2bAuthTokenExpiresAt,
      isActive,
      isDefault: record.isDefault === true,
      pickupLocationIds,
      pickupLocationNames,
      isConfigured: isDelhiveryAccountConfiguredForAdmin({
        index,
        apiKey: nextApiKey || existing?.apiKey || '',
        username: nextUsername || existing?.username || '',
        password: nextPassword || existing?.password || '',
        b2bAuthToken,
      }),
    } as DelhiveryAccountConfig
  })

  let defaultIndex = accounts.findIndex(
    (account) => account.isDefault && account.isActive && account.isConfigured,
  )
  if (defaultIndex < 0) {
    defaultIndex = accounts.findIndex((account) => account.isActive && account.isConfigured)
  }
  if (defaultIndex < 0) {
    defaultIndex = 0
  }

  return accounts.map((account, index) => ({
    ...account,
    isDefault: index === defaultIndex,
  }))
}

export const getCourierCredentialsController = async (req: Request, res: Response) => {
  try {
    const delhiveryAccounts = await getDelhiveryAccounts()
    res.json({
      success: true,
      data: {
        delhivery: buildDelhiveryCredentialResponse(delhiveryAccounts),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to fetch courier credentials' })
  }
}

export const updateXpressbeesAwbRangeController = async (req: any, res: Response) => {
  try {
    const result = await createXpressbeesManualAwbRange({
      startAwb: req.body?.startAwb ?? req.body?.awbStartNumber ?? req.body?.start,
      endAwb: req.body?.endAwb ?? req.body?.awbEndNumber ?? req.body?.end,
      createdBy: req.user?.sub || null,
    })

    res.json({
      success: true,
      message: 'Xpressbees manual AWB range updated successfully',
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to update Xpressbees manual AWB range:', err)
    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500
    res.status(statusCode).json({
      success: false,
      message: err?.message || 'Failed to update Xpressbees manual AWB range',
    })
  }
}

export const updateDelhiveryCredentialsController = async (req: Request, res: Response) => {
  const { apiBase, clientName, apiKey, accounts } = req.body || {}

  try {
    const [existingRow] = await db
      .select({
        id: courier_credentials.id,
        apiBase: courier_credentials.apiBase,
        clientName: courier_credentials.clientName,
        apiKey: courier_credentials.apiKey,
        metadata: courier_credentials.metadata,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'delhivery'))
      .limit(1)

    const existingAccounts = await getDelhiveryAccounts()
    const nextAccounts = Array.isArray(accounts)
      ? sanitizeDelhiveryAccountsPayload(accounts, existingAccounts)
      : sanitizeDelhiveryAccountsPayload(
          [
            {
              accountLabel:
                existingAccounts[0]?.accountLabel || getDefaultDelhiveryAccountLabel(0),
              apiBase,
              clientName,
              username: existingAccounts[0]?.username || '',
              apiKey,
              password: existingAccounts[0]?.password || '',
              isActive: existingAccounts[0]?.isActive ?? true,
              isDefault: true,
              pickupLocationIds: existingAccounts[0]?.pickupLocationIds || [],
              pickupLocationNames: existingAccounts[0]?.pickupLocationNames || [],
            },
            existingAccounts[1],
            existingAccounts[2],
          ],
          existingAccounts,
        )

    const primaryAccount =
      nextAccounts.find((account) => account.isDefault) ||
      nextAccounts.find((account) => account.isActive && account.isConfigured) ||
      nextAccounts[0]

    const nextMetadata = {
      ...(existingRow?.metadata && typeof existingRow.metadata === 'object' ? existingRow.metadata : {}),
      delhiveryAccounts: serializeDelhiveryAccountsForMetadata(nextAccounts),
      delhiveryAccountsVersion: 2,
    }

    if (existingRow) {
      const updatePayload: Record<string, any> = {
        apiBase: primaryAccount?.apiBase || DEFAULT_DELHIVERY_API_BASE,
        clientName: primaryAccount?.clientName || '',
        apiKey: primaryAccount?.apiKey || '',
        username: primaryAccount?.username || '',
        password: primaryAccount?.password || '',
        metadata: nextMetadata,
        updatedAt: new Date(),
      }

      await db
        .update(courier_credentials)
        .set(updatePayload)
        .where(eq(courier_credentials.provider, 'delhivery'))
    } else {
      await db.insert(courier_credentials).values({
        provider: 'delhivery',
        apiBase: primaryAccount?.apiBase || DEFAULT_DELHIVERY_API_BASE,
        clientName: primaryAccount?.clientName || '',
        apiKey: primaryAccount?.apiKey || '',
        username: primaryAccount?.username || '',
        password: primaryAccount?.password || '',
        metadata: nextMetadata,
      })
    }

    res.json({
      success: true,
      message: 'Delhivery credentials updated successfully',
      data: buildDelhiveryCredentialResponse(nextAccounts),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update Delhivery credentials' })
  }
}

const persistDelhiveryB2BToken = async ({
  accountCode,
  token,
  expiresAt,
}: {
  accountCode: string
  token: string
  expiresAt: string
}) => {
  const [existingRow] = await db
    .select({ metadata: courier_credentials.metadata })
    .from(courier_credentials)
    .where(eq(courier_credentials.provider, 'delhivery'))
    .limit(1)

  if (!existingRow) return

  const accounts = await getDelhiveryAccounts()
  const nextAccounts = accounts.map((account) =>
    account.accountCode === accountCode
      ? {
          ...account,
          b2bAuthToken: token,
          b2bAuthTokenExpiresAt: expiresAt,
        }
      : account,
  )

  const nextMetadata = {
    ...(existingRow.metadata && typeof existingRow.metadata === 'object' ? existingRow.metadata : {}),
    delhiveryAccounts: serializeDelhiveryAccountsForMetadata(nextAccounts),
    delhiveryAccountsVersion: 2,
  }

  await db
    .update(courier_credentials)
    .set({
      metadata: nextMetadata,
      updatedAt: new Date(),
    })
    .where(eq(courier_credentials.provider, 'delhivery'))
}

const resolveDelhiveryB2BAccountForAdmin = async (accountCode = 'account_2') => {
  const accounts = await getDelhiveryAccounts()
  return (
    accounts.find((account) => account.accountCode === accountCode) ||
    accounts[1] ||
    accounts[0]
  )
}

const resolveDelhiveryB2BTokenForAdmin = (req: Request, account?: DelhiveryAccountConfig) => {
  const directToken = String(req.body?.token || req.headers.authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim()

  return directToken || account?.b2bAuthToken || ''
}

const respondWithDelhiveryB2BResult = (
  res: Response,
  message: string,
  result: { apiBase: string; status: number; data: unknown },
) =>
  res.json({
    success: true,
    message,
    data: {
      apiBase: result.apiBase,
      status: result.status,
      providerResponse: result.data,
    },
  })

const handleDelhiveryB2BAdminError = (res: Response, err: any, fallbackMessage: string) => {
  console.error(fallbackMessage, err)
  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500
  res.status(statusCode).json({
    success: false,
    message: err?.message || fallbackMessage,
  })
}

export const resetDelhiveryPasswordController = async (req: Request, res: Response) => {
  try {
    const requestedAccountCode = String(req.body?.accountCode || 'account_2').trim()
    const requestedUsername = String(req.body?.username || '').trim()
    const requestedApiBase = String(req.body?.apiBase || '').trim()

    const accounts = await getDelhiveryAccounts()
    const selectedAccount =
      accounts.find((account) => account.accountCode === requestedAccountCode) || accounts[1] || accounts[0]

    const username = requestedUsername || selectedAccount?.username || ''
    const apiBase = requestedApiBase || selectedAccount?.apiBase || ''

    const result = await triggerDelhiveryForgotPassword({
      username,
      apiBase,
    })

    res.json({
      success: true,
      message: 'Delhivery password reset request submitted successfully',
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to trigger Delhivery forgot-password request:', err)
    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500
    res.status(statusCode).json({
      success: false,
      message: err?.message || 'Failed to submit Delhivery password reset request',
      data: err?.data || null,
    })
  }
}

export const loginDelhiveryB2BController = async (req: Request, res: Response) => {
  try {
    const requestedAccountCode = String(req.body?.accountCode || 'account_2').trim()
    const requestedUsername = String(req.body?.username || '').trim()
    const requestedPassword = String(req.body?.password || '').trim()
    const requestedApiBase = String(req.body?.apiBase || '').trim()

    const accounts = await getDelhiveryAccounts()
    const selectedAccount =
      accounts.find((account) => account.accountCode === requestedAccountCode) ||
      accounts[1] ||
      accounts[0]

    const username = requestedUsername || selectedAccount?.username || ''
    const password = requestedPassword || selectedAccount?.password || ''
    const apiBase = requestedApiBase || selectedAccount?.apiBase || ''

    const result = await loginDelhiveryB2B({
      username,
      password,
      apiBase,
    })

    if (result.token) {
      await persistDelhiveryB2BToken({
        accountCode: selectedAccount?.accountCode || requestedAccountCode,
        token: result.token,
        expiresAt: result.expiresAt,
      })
    }

    res.json({
      success: true,
      message: 'Delhivery B2B login successful',
      data: {
        apiBase: result.apiBase,
        status: result.status,
        tokenType: result.tokenType,
        hasToken: Boolean(result.token),
        tokenMasked: result.token
          ? `${result.token.slice(0, 8)}...${result.token.slice(-6)}`
          : '',
        expiresAt: result.expiresAt,
      },
    })
  } catch (err: any) {
    console.error('Failed to login to Delhivery B2B:', err)
    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500
    res.status(statusCode).json({
      success: false,
      message: err?.message || 'Failed to login to Delhivery B2B',
    })
  }
}

export const logoutDelhiveryB2BController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await logoutDelhiveryB2B({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
    })

    if (account?.accountCode) {
      await persistDelhiveryB2BToken({
        accountCode: account.accountCode,
        token: '',
        expiresAt: '',
      })
    }

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B logout successful', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to logout from Delhivery B2B')
  }
}

export const checkDelhiveryB2BServiceabilityController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await checkDelhiveryB2BServiceability({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      pincode: String(req.body?.pincode || req.body?.consigneePin || '').trim(),
      weight: req.body?.weight,
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B serviceability fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B serviceability')
  }
}

export const estimateDelhiveryB2BTatController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await estimateDelhiveryB2BTat({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      originPin: String(req.body?.originPin || req.body?.origin_pin || '').trim(),
      destinationPin: String(req.body?.destinationPin || req.body?.destination_pin || '').trim(),
      requestId: String(req.body?.requestId || '').trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B TAT fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B TAT')
  }
}

export const estimateDelhiveryB2BFreightController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const { accountCode: _accountCode, token: _token, apiBase: _apiBase, ...payload } = req.body || {}
    const result = await estimateDelhiveryB2BFreight({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      payload,
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B freight estimate fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B freight estimate')
  }
}

export const getDelhiveryB2BFreightChargesController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await getDelhiveryB2BFreightCharges({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      lrns: String(req.body?.lrns || '').trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B freight charges fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B freight charges')
  }
}

export const createDelhiveryB2BClientWarehouseController = async (
  req: Request,
  res: Response,
) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const { accountCode: _accountCode, token: _token, apiBase: _apiBase, ...payload } = req.body || {}
    const result = await createDelhiveryB2BClientWarehouse({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      payload,
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B client warehouse created', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to create Delhivery B2B client warehouse')
  }
}

export const updateDelhiveryB2BClientWarehouseController = async (
  req: Request,
  res: Response,
) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const { accountCode: _accountCode, token: _token, apiBase: _apiBase, ...payload } = req.body || {}
    const result = await updateDelhiveryB2BClientWarehouse({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      payload,
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B client warehouse updated', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to update Delhivery B2B client warehouse')
  }
}

export const createDelhiveryB2BShipmentController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const { accountCode: _accountCode, token: _token, apiBase: _apiBase, ...payload } = req.body || {}
    const result = await createDelhiveryB2BShipment({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      payload,
    })
    const jobId = extractDelhiveryB2BJobId(result.data)

    res.json({
      success: true,
      message: 'Delhivery B2B shipment creation submitted',
      data: {
        apiBase: result.apiBase,
        status: result.status,
        jobId,
        providerResponse: result.data,
      },
    })
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to create Delhivery B2B shipment')
  }
}

export const getDelhiveryB2BShipmentStatusController = async (
  req: Request,
  res: Response,
) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await getDelhiveryB2BShipmentStatus({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      jobId: String(req.body?.jobId || req.body?.job_id || '').trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B shipment status fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B shipment status')
  }
}

export const updateDelhiveryB2BShipmentController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const {
      accountCode: _accountCode,
      token: _token,
      apiBase: _apiBase,
      lrn,
      lrn_number,
      ...payload
    } = req.body || {}
    const result = await updateDelhiveryB2BShipment({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      lrn: String(lrn || lrn_number || '').trim(),
      payload,
    })
    const jobId = extractDelhiveryB2BJobId(result.data)

    res.json({
      success: true,
      message: 'Delhivery B2B shipment update submitted',
      data: {
        apiBase: result.apiBase,
        status: result.status,
        jobId,
        providerResponse: result.data,
      },
    })
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to update Delhivery B2B shipment')
  }
}

export const getDelhiveryB2BShipmentUpdateStatusController = async (
  req: Request,
  res: Response,
) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await getDelhiveryB2BShipmentUpdateStatus({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      jobId: String(req.body?.jobId || req.body?.job_id || '').trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B shipment update status fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B shipment update status')
  }
}

export const cancelDelhiveryB2BShipmentController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await cancelDelhiveryB2BShipment({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      lrn: String(req.body?.lrn || req.body?.lrn_number || '').trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B shipment cancelled', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to cancel Delhivery B2B shipment')
  }
}

export const trackDelhiveryB2BShipmentController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await trackDelhiveryB2BShipment({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      lrn: String(req.body?.lrn || req.body?.lrnum || '').trim(),
      allWbns: typeof req.body?.allWbns === 'boolean'
        ? req.body.allWbns
        : typeof req.body?.all_wbns === 'boolean'
          ? req.body.all_wbns
          : undefined,
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B shipment tracking fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B shipment tracking')
  }
}

export const bookDelhiveryB2BAppointmentController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const { accountCode: _accountCode, token: _token, apiBase: _apiBase, ...payload } = req.body || {}
    const result = await bookDelhiveryB2BAppointment({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      payload,
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B appointment booked', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to book Delhivery B2B appointment')
  }
}

export const createDelhiveryB2BPickupRequestController = async (
  req: Request,
  res: Response,
) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const {
      accountCode: _accountCode,
      token: _token,
      apiBase: _apiBase,
      requestId,
      request_id,
      xRequestId,
      x_request_id,
      ...payload
    } = req.body || {}
    const result = await createDelhiveryB2BPickupRequest({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      payload,
      requestId: String(requestId || request_id || xRequestId || x_request_id || '').trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B pickup request created', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to create Delhivery B2B pickup request')
  }
}

export const cancelDelhiveryB2BPickupRequestController = async (
  req: Request,
  res: Response,
) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await cancelDelhiveryB2BPickupRequest({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      pickupId: String(req.body?.pickupId || req.body?.pickup_id || '').trim(),
      requestId: String(
        req.body?.requestId ||
          req.body?.request_id ||
          req.body?.xRequestId ||
          req.body?.x_request_id ||
          '',
      ).trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B pickup request cancelled', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to cancel Delhivery B2B pickup request')
  }
}

export const getDelhiveryB2BLabelUrlsController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await getDelhiveryB2BLabelUrls({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      size: String(req.body?.size || '').trim(),
      lrn: String(req.body?.lrn || req.body?.lrn_number || '').trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B label URLs fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B label URLs')
  }
}

export const getDelhiveryB2BLrCopyController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await getDelhiveryB2BLrCopy({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      lrn: String(req.body?.lrn || req.body?.lrn_number || '').trim(),
      lrCopyType: String(req.body?.lrCopyType || req.body?.lr_copy_type || '').trim(),
      requestId: String(
        req.body?.requestId ||
          req.body?.request_id ||
          req.body?.xRequestId ||
          req.body?.x_request_id ||
          '',
      ).trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B LR copy fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B LR copy')
  }
}

export const generateDelhiveryB2BDocumentController = async (req: Request, res: Response) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const {
      accountCode: _accountCode,
      token: _token,
      apiBase: _apiBase,
      docType,
      doc_type,
      requestId,
      request_id,
      xRequestId,
      x_request_id,
      ...payload
    } = req.body || {}
    const result = await generateDelhiveryB2BDocument({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      docType: String(docType || doc_type || '').trim(),
      payload,
      requestId: String(requestId || request_id || xRequestId || x_request_id || '').trim(),
    })
    const jobId = extractDelhiveryB2BJobId(result.data)

    res.json({
      success: true,
      message: 'Delhivery B2B document generation submitted',
      data: {
        apiBase: result.apiBase,
        status: result.status,
        jobId,
        providerResponse: result.data,
      },
    })
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to generate Delhivery B2B document')
  }
}

export const getDelhiveryB2BDocumentStatusController = async (
  req: Request,
  res: Response,
) => {
  try {
    const accountCode = String(req.body?.accountCode || 'account_2').trim()
    const account = await resolveDelhiveryB2BAccountForAdmin(accountCode)
    const result = await getDelhiveryB2BDocumentStatus({
      token: resolveDelhiveryB2BTokenForAdmin(req, account),
      apiBase: String(req.body?.apiBase || account?.apiBase || '').trim(),
      docType: String(req.body?.docType || req.body?.doc_type || '').trim(),
      jobId: String(req.body?.jobId || req.body?.job_id || '').trim(),
      requestId: String(
        req.body?.requestId ||
          req.body?.request_id ||
          req.body?.xRequestId ||
          req.body?.x_request_id ||
          '',
      ).trim(),
    })

    respondWithDelhiveryB2BResult(res, 'Delhivery B2B document status fetched', result)
  } catch (err: any) {
    handleDelhiveryB2BAdminError(res, err, 'Failed to fetch Delhivery B2B document status')
  }
}

export const updateEkartCredentialsController = async (req: Request, res: Response) => {
  const { apiBase, clientId, username, password, webhookSecret } = req.body || {}

  try {
    const nextApiBase = typeof apiBase === 'string' ? apiBase.trim() : undefined
    const nextClientId = typeof clientId === 'string' ? clientId.trim() : undefined
    const nextUsername = typeof username === 'string' ? username.trim() : undefined
    const nextPassword = typeof password === 'string' ? password.trim() : undefined
    const hasPassword = typeof nextPassword === 'string' && nextPassword.length > 0
    const hasWebhookSecret = typeof webhookSecret === 'string' && webhookSecret.length > 0

    const [existing] = await db
      .select({ id: courier_credentials.id })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'ekart'))
      .limit(1)

    if (existing) {
      const updatePayload: Record<string, any> = {
        updatedAt: new Date(),
      }
      if (nextApiBase !== undefined) {
        updatePayload.apiBase = nextApiBase || 'https://api.ekartlogistics.com'
      }
      if (nextClientId !== undefined) {
        updatePayload.clientId = nextClientId
      }
      if (nextUsername !== undefined) {
        updatePayload.username = nextUsername
      }
      if (hasPassword) {
        updatePayload.password = nextPassword
      }
      if (hasWebhookSecret) {
        updatePayload.webhookSecret = webhookSecret
      }

      await db
        .update(courier_credentials)
        .set(updatePayload)
        .where(eq(courier_credentials.provider, 'ekart'))
    } else {
      await db.insert(courier_credentials).values({
        provider: 'ekart',
        apiBase: nextApiBase || 'https://api.ekartlogistics.com',
        clientName: '',
        apiKey: '',
        clientId: nextClientId || '',
        username: nextUsername || '',
        password: hasPassword ? nextPassword : '',
        webhookSecret: hasWebhookSecret ? webhookSecret : '',
      })
    }

    const [saved] = await db
      .select({
        apiBase: courier_credentials.apiBase,
        clientId: courier_credentials.clientId,
        username: courier_credentials.username,
        password: courier_credentials.password,
        webhookSecret: courier_credentials.webhookSecret,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'ekart'))
      .limit(1)

    res.json({
      success: true,
      message: 'Ekart credentials updated successfully',
      data: {
        provider: 'ekart',
        apiBase: saved?.apiBase || 'https://api.ekartlogistics.com',
        clientId: saved?.clientId || '',
        username: saved?.username || '',
        hasPassword: Boolean((saved?.password || '').trim()),
        hasWebhookSecret: Boolean((saved?.webhookSecret || '').trim()),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update Ekart credentials' })
  }
}

export const updateXpressbeesCredentialsController = async (req: Request, res: Response) => {
  const {
    apiBase,
    username,
    password,
    apiKey,
    webhookSecret,
    authBearer,
    secretKey,
    xbKey,
    xbAccessKey,
    businessUnit,
    businessFlow,
    businessService,
    businessServices,
    businessAccountName,
    pickupVendorCode,
    manifestServiceType,
    manifestPickupType,
    pincodeBusinessUnit,
    pincodeBusinessFlow,
    pickupBusinessService,
    deliveryBusinessService,
    serviceabilityVersion,
    trackingVersion,
  } = req.body || {}

  try {
    const nextApiBase = typeof apiBase === 'string' ? apiBase.trim() : undefined
    const nextUsername = typeof username === 'string' ? username.trim() : undefined
    const nextPassword = typeof password === 'string' ? password.trim() : undefined
    const nextApiKey = typeof apiKey === 'string' ? apiKey.trim() : undefined
    const nextWebhookSecret =
      typeof webhookSecret === 'string' ? webhookSecret.trim() : undefined
    const hasPassword = typeof nextPassword === 'string' && nextPassword.length > 0
    const hasApiKey = typeof nextApiKey === 'string' && nextApiKey.length > 0
    const hasWebhookSecret =
      typeof nextWebhookSecret === 'string' && nextWebhookSecret.length > 0
    const metadataInputs: Record<string, any> = {
      authBearer,
      secretKey,
      xbKey,
      xbAccessKey,
      businessUnit,
      businessFlow,
      businessService,
      businessServices,
      businessAccountName,
      pickupVendorCode,
      manifestServiceType,
      manifestPickupType,
      pincodeBusinessUnit,
      pincodeBusinessFlow,
      pickupBusinessService,
      deliveryBusinessService,
      serviceabilityVersion,
      trackingVersion,
    }
    const metadataUpdates = Object.entries(metadataInputs).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (typeof value !== 'string') return acc
        const normalized = value.trim()
        if (!normalized && ['authBearer', 'secretKey', 'xbKey', 'xbAccessKey'].includes(key)) {
          return acc
        }
        acc[key] = normalized
        return acc
      },
      {},
    )

    const [existing] = await db
      .select({ id: courier_credentials.id, metadata: courier_credentials.metadata })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'xpressbees'))
      .limit(1)

    if (existing) {
      const updatePayload: Record<string, any> = {
        updatedAt: new Date(),
      }
      if (nextApiBase !== undefined) {
        updatePayload.apiBase = nextApiBase || 'https://shipment.xpressbees.com'
      }
      if (nextUsername !== undefined) {
        updatePayload.username = nextUsername
      }
      if (hasPassword) {
        updatePayload.password = nextPassword
      }
      if (hasApiKey) {
        updatePayload.apiKey = nextApiKey
      }
      if (hasWebhookSecret) {
        updatePayload.webhookSecret = nextWebhookSecret
      }
      if (Object.keys(metadataUpdates).length) {
        const existingMetadata =
          existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}
        updatePayload.metadata = {
          ...existingMetadata,
          ...metadataUpdates,
        }
      }

      await db
        .update(courier_credentials)
        .set(updatePayload)
        .where(eq(courier_credentials.provider, 'xpressbees'))
    } else {
      await db.insert(courier_credentials).values({
        provider: 'xpressbees',
        apiBase: nextApiBase || 'https://shipment.xpressbees.com',
        clientName: '',
        apiKey: hasApiKey ? nextApiKey : '',
        clientId: '',
        username: nextUsername || '',
        password: hasPassword ? nextPassword : '',
        webhookSecret: hasWebhookSecret ? nextWebhookSecret : '',
        metadata: {
          pincodeBusinessUnit: 'eComm',
          pincodeBusinessFlow: 'Forward',
          pickupBusinessService: 'PickUp',
          deliveryBusinessService: 'Delivery',
          serviceabilityVersion: 'v1',
          trackingVersion: 'v1',
          ...metadataUpdates,
        },
      })
    }

    const [saved] = await db
      .select({
        apiBase: courier_credentials.apiBase,
        username: courier_credentials.username,
        password: courier_credentials.password,
        apiKey: courier_credentials.apiKey,
        webhookSecret: courier_credentials.webhookSecret,
        metadata: courier_credentials.metadata,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'xpressbees'))
      .limit(1)

    XpressbeesService.clearCachedConfig()

    res.json({
      success: true,
      message: 'Xpressbees credentials updated successfully',
      data: {
        provider: 'xpressbees',
        apiBase: saved?.apiBase || 'https://shipment.xpressbees.com',
        username: saved?.username || '',
        hasPassword: Boolean((saved?.password || '').trim()),
        hasApiKey: Boolean((saved?.apiKey || '').trim()),
        hasAuthBearer: Boolean(
          String(
            (saved?.metadata as any)?.authBearer ||
              (saved?.metadata as any)?.auth_bearer ||
              (saved?.metadata as any)?.authorizationBearer ||
              '',
          ).trim(),
        ),
        hasSecretKey: Boolean(
          String(
            (saved?.metadata as any)?.secretKey || (saved?.metadata as any)?.secret_key || '',
          ).trim(),
        ),
        hasXbKey: Boolean(
          String((saved?.metadata as any)?.xbKey || (saved?.metadata as any)?.xb_key || '').trim(),
        ),
        hasXbAccessKey: Boolean(
          String(
            (saved?.metadata as any)?.xbAccessKey ||
              (saved?.metadata as any)?.xb_access_key ||
              '',
          ).trim(),
        ),
        businessAccountName: String(
          (saved?.metadata as any)?.businessAccountName ||
            (saved?.metadata as any)?.business_account_name ||
            '',
        ).trim(),
        pickupVendorCode: String(
          (saved?.metadata as any)?.pickupVendorCode ||
            (saved?.metadata as any)?.pickup_vendor_code ||
            '',
        ).trim(),
        hasBusinessAccountName: Boolean(
          String(
            (saved?.metadata as any)?.businessAccountName ||
              (saved?.metadata as any)?.business_account_name ||
              '',
          ).trim(),
        ),
        hasPickupVendorCode: Boolean(
          String(
            (saved?.metadata as any)?.pickupVendorCode ||
              (saved?.metadata as any)?.pickup_vendor_code ||
            '',
          ).trim(),
        ),
        businessUnit: (saved?.metadata as any)?.businessUnit || 'ECOM',
        businessFlow: (saved?.metadata as any)?.businessFlow || 'FORWARD',
        businessService: (saved?.metadata as any)?.businessService || '',
        businessServices:
          (saved?.metadata as any)?.businessServices || 'SD,SDD,NDD,AIR,SFC,IntraSDD',
        manifestServiceType: (saved?.metadata as any)?.manifestServiceType || 'SD',
        manifestPickupType: (saved?.metadata as any)?.manifestPickupType || 'Vendor',
        hasWebhookSecret: Boolean((saved?.webhookSecret || '').trim()),
        pincodeBusinessUnit: (saved?.metadata as any)?.pincodeBusinessUnit || 'eComm',
        pincodeBusinessFlow: (saved?.metadata as any)?.pincodeBusinessFlow || 'Forward',
        pickupBusinessService: (saved?.metadata as any)?.pickupBusinessService || 'PickUp',
        deliveryBusinessService: (saved?.metadata as any)?.deliveryBusinessService || 'Delivery',
        serviceabilityVersion: (saved?.metadata as any)?.serviceabilityVersion || 'v1',
        trackingVersion: (saved?.metadata as any)?.trackingVersion || 'v1',
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update Xpressbees credentials' })
  }
}

export const updateShadowfaxCredentialsController = async (req: Request, res: Response) => {
  const { apiBase, clientName, apiKey, webhookSecret } = req.body || {}

  try {
    const nextApiBase = typeof apiBase === 'string' ? apiBase.trim() : undefined
    const nextClientName = typeof clientName === 'string' ? clientName.trim() : undefined
    const nextApiKey = typeof apiKey === 'string' ? apiKey.trim() : undefined
    const nextWebhookSecret =
      typeof webhookSecret === 'string' ? webhookSecret.trim() : undefined
    const hasNewApiKey = typeof nextApiKey === 'string' && nextApiKey.length > 0
    const hasWebhookSecret =
      typeof nextWebhookSecret === 'string' && nextWebhookSecret.length > 0

    const [existing] = await db
      .select({ id: courier_credentials.id })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'shadowfax'))
      .limit(1)

    if (existing) {
      const updatePayload: Record<string, any> = {
        updatedAt: new Date(),
      }
      if (nextApiBase !== undefined) {
        updatePayload.apiBase = nextApiBase || 'https://dale.staging.shadowfax.in/api'
      }
      if (nextClientName !== undefined) {
        updatePayload.clientName = nextClientName
      }
      if (hasNewApiKey) {
        updatePayload.apiKey = nextApiKey
      }
      if (hasWebhookSecret) {
        updatePayload.webhookSecret = nextWebhookSecret
      }

      await db
        .update(courier_credentials)
        .set(updatePayload)
        .where(eq(courier_credentials.provider, 'shadowfax'))
    } else {
      await db.insert(courier_credentials).values({
        provider: 'shadowfax',
        apiBase: nextApiBase || 'https://dale.staging.shadowfax.in/api',
        clientName: nextClientName || '',
        apiKey: hasNewApiKey ? nextApiKey : '',
        webhookSecret: hasWebhookSecret ? nextWebhookSecret : '',
      })
    }

    const [saved] = await db
      .select({
        apiBase: courier_credentials.apiBase,
        clientName: courier_credentials.clientName,
        apiKey: courier_credentials.apiKey,
        webhookSecret: courier_credentials.webhookSecret,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'shadowfax'))
      .limit(1)

    ShadowfaxService.clearCachedConfig()

    res.json({
      success: true,
      message: 'Shadowfax credentials updated successfully',
      data: {
        provider: 'shadowfax',
        apiBase: saved?.apiBase || 'https://dale.staging.shadowfax.in/api',
        clientName: saved?.clientName || '',
        hasApiKey: Boolean((saved?.apiKey || '').trim()),
        hasWebhookSecret: Boolean((saved?.webhookSecret || '').trim()),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update Shadowfax credentials' })
  }
}

export const updateAmazonCredentialsController = async (req: Request, res: Response) => {
  const {
    apiBase,
    endpoint,
    accessToken,
    refreshToken,
    lwaClientId,
    clientId,
    lwaClientSecret,
    clientSecret,
    shippingBusinessId,
    region,
    sandbox,
    lwaTokenUrl,
    tokenUrl,
  } = req.body || {}

  try {
    const [existing] = await db
      .select()
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, AMAZON_CREDENTIALS_PROVIDER))
      .limit(1)

    const nextCredentials = { ...buildAmazonShippingCredentialsFromRow(existing) }
    const nextEndpoint = optionalCredentialString(endpoint) ?? optionalCredentialString(apiBase)
    const nextAccessToken = optionalCredentialString(accessToken)
    const nextRefreshToken = optionalCredentialString(refreshToken)
    const nextLwaClientId = optionalCredentialString(lwaClientId) ?? optionalCredentialString(clientId)
    const nextLwaClientSecret =
      optionalCredentialString(lwaClientSecret) ?? optionalCredentialString(clientSecret)
    const nextShippingBusinessId = optionalCredentialString(shippingBusinessId)
    const nextRegion = optionalCredentialString(region)
    const nextLwaTokenUrl =
      optionalCredentialString(lwaTokenUrl) ?? optionalCredentialString(tokenUrl)

    if (nextEndpoint !== undefined) {
      nextCredentials.endpoint = nextEndpoint
    }
    if (nextAccessToken) {
      nextCredentials.accessToken = nextAccessToken
    }
    if (nextRefreshToken) {
      nextCredentials.refreshToken = nextRefreshToken
    }
    if (nextLwaClientId !== undefined) {
      nextCredentials.lwaClientId = nextLwaClientId
    }
    if (nextLwaClientSecret) {
      nextCredentials.lwaClientSecret = nextLwaClientSecret
    }
    if (nextShippingBusinessId !== undefined) {
      nextCredentials.shippingBusinessId = nextShippingBusinessId || AMAZON_DEFAULT_BUSINESS_ID
    }
    if (nextRegion !== undefined) {
      nextCredentials.region = nextRegion || AMAZON_DEFAULT_REGION
    }
    if (sandbox !== undefined) {
      nextCredentials.sandbox = parseAmazonSandboxFlag(sandbox)
    }
    if (nextLwaTokenUrl !== undefined) {
      nextCredentials.lwaTokenUrl = nextLwaTokenUrl
    }

    const normalizedTokens = normalizeAmazonCredentialTokens({
      accessToken: nextCredentials.accessToken,
      refreshToken: nextCredentials.refreshToken,
    })
    nextCredentials.accessToken = normalizedTokens.accessToken
    nextCredentials.refreshToken = normalizedTokens.refreshToken

    const metadata = {
      accessToken: normalizeAmazonCredentialValue(nextCredentials.accessToken),
      refreshToken: normalizeAmazonCredentialValue(nextCredentials.refreshToken),
      lwaClientId: normalizeAmazonCredentialValue(nextCredentials.lwaClientId),
      lwaClientSecret: normalizeAmazonCredentialValue(nextCredentials.lwaClientSecret),
      endpoint: normalizeAmazonCredentialValue(nextCredentials.endpoint),
      region: normalizeAmazonCredentialValue(nextCredentials.region) || AMAZON_DEFAULT_REGION,
      sandbox: Boolean(nextCredentials.sandbox),
      shippingBusinessId:
        normalizeAmazonCredentialValue(nextCredentials.shippingBusinessId) ||
        AMAZON_DEFAULT_BUSINESS_ID,
      lwaTokenUrl: normalizeAmazonCredentialValue(nextCredentials.lwaTokenUrl),
    }

    const values = {
      provider: AMAZON_CREDENTIALS_PROVIDER,
      apiBase: metadata.endpoint,
      clientName: metadata.shippingBusinessId,
      apiKey: metadata.refreshToken || metadata.accessToken,
      clientId: metadata.lwaClientId,
      username: metadata.region,
      password: metadata.lwaClientSecret,
      webhookSecret: String(metadata.sandbox),
      metadata,
      updatedAt: new Date(),
    }

    await db
      .insert(courier_credentials)
      .values(values)
      .onConflictDoUpdate({
        target: courier_credentials.provider,
        set: values,
      })

    applyAmazonShippingCredentialsToEnv(nextCredentials, { overwriteExisting: true })

    const [saved] = await db
      .select()
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, AMAZON_CREDENTIALS_PROVIDER))
      .limit(1)

    res.json({
      success: true,
      message: 'Amazon credentials updated successfully',
      data: buildAmazonCredentialResponse(saved),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update Amazon credentials' })
  }
}

export interface RateType {
  forward?: string | number
  rto?: string | number
}

// Utility: convert numbers to string for decimal fields
export const numericToString = (val: string | number | null | undefined): string | null => {
  if (val === null || val === undefined || val === '') return null
  return String(val)
}

// ---------------- Controller ----------------
export const updateShippingRateController = async (req: Request, res: Response) => {
  try {
    const courierId = Number(req.params.id) // courier_id from params
    let planId: string | undefined = req.params.planId // plan_id from params

    // Fallback: try to get planId from query or body if not in params
    if (!planId || planId === 'undefined') {
      planId = (req.query.planId as string) || (req.body.planId as string) || undefined
    }

    if (!courierId || isNaN(courierId)) {
      return res.status(400).json({ success: false, message: 'Invalid courier ID' })
    }

    if (!planId || planId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing plan ID. Please ensure a plan is selected.',
      })
    }

    const updates: ShippingRateUpdatePayload = req.body

    console.log(`[updateShippingRateController] courierId: ${courierId}, planId: ${planId}`)

    const updated = await updateShippingRate(courierId, updates, planId)
    if (!updated) return res.status(404).json({ success: false, message: 'Rate card not found' })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.log('Error updating shipping rate:', err)
    const statusCode = isSlabValidationError(err) ? 400 : 500
    res.status(statusCode).json({
      success: false,
      message: isSlabValidationError(err)
        ? String((err as any)?.message || 'Invalid slab configuration')
        : 'Internal Server Error',
    })
  }
}

const isExcelRateCard = (file: any) => {
  const name = String(file?.originalname || '').toLowerCase()
  const mime = String(file?.mimetype || '').toLowerCase()
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel')
  )
}

const parseRateCardFile = (file: any) => {
  if (isExcelRateCard(file)) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      return { data: [] as CSVRow[], errors: [{ message: 'Excel file has no sheets' }] }
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false,
      blankrows: false,
    })

    return { data: rows.map(normalizeRateCardRow), errors: [] as any[] }
  }

  return parseRateCardCsvText(file.buffer.toString('utf8'))
}

export const importShippingRatesController = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    const { planId: plan_id, businessType: business_type } = req.query
    if (!plan_id || !business_type) {
      return res.status(400).json({ success: false, message: 'Missing plan_id or business_type' })
    }

    const normalizedBusinessType = String(business_type).toLowerCase()
    if (normalizedBusinessType !== 'b2b' && normalizedBusinessType !== 'b2c') {
      return res.status(400).json({ success: false, message: 'Invalid business_type' })
    }

    const { data, errors } = parseRateCardFile(req.file)

    if (errors.length) {
      console.error('Rate card parse errors:', errors)
      return res.status(400).json({ success: false, message: 'Invalid rate card file', errors })
    }

    const zonesList = await getAllZones(normalizedBusinessType)

    // Detect format: new slab-per-row format has a "Slab Type" column
    const headers = data.length ? Object.keys(data[0]) : []
    const isSlabFormat = headers.some((h) => h.trim() === 'Slab Type')
    let savedRows = 0

    if (normalizedBusinessType === 'b2c' && isSlabFormat) {
      savedRows = await importB2CSlabFormat(data as CSVRow[], plan_id as string, zonesList)
    } else {
      savedRows = await importFlatFormat(data as CSVRow[], plan_id as string, normalizedBusinessType, zonesList)
    }

    if (savedRows === 0) {
      return res.status(400).json({
        success: false,
        message:
          'No rate rows were imported. Check the plan, courier, mode, zone column names, and rate values in the file.',
      })
    }

    res.json({
      success: true,
      message: `Shipping rates imported successfully. ${savedRows} rate rows saved.`,
      data: { savedRows },
    })
  } catch (err) {
    console.error('Error importing shipping rates:', err)
    const statusCode = isSlabValidationError(err) ? 400 : 500
    res.status(statusCode).json({
      success: false,
      message: isSlabValidationError(err)
        ? String((err as any)?.message || 'Invalid slab configuration')
        : 'Internal Server Error',
    })
  }
}

export const deleteShippingRateController = async (req: Request, res: Response) => {
  try {
    const courierId = Number(req.params.id)
    const planId = req.params.planId
    const businessType = req.query.businessType as 'b2b' | 'b2c'
    const zoneId = req.query.zoneId as string | undefined
    const serviceProvider = req.query.serviceProvider as string | undefined
    const mode = req.query.mode as string | undefined

    if (!courierId || !planId || !businessType) {
      return res
        .status(400)
        .json({ success: false, message: 'courierId, planId and businessType are required' })
    }

    const deleted = await deleteShippingRate(
      courierId,
      planId,
      businessType,
      zoneId,
      serviceProvider,
      mode,
    )

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'No matching rate found' })
    }

    res.json({ success: true, message: 'Rate(s) deleted successfully', data: deleted })
  } catch (err) {
    console.error('Error deleting shipping rate:', err)
    res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}

export const deleteCourierController = async (req: Request, res: Response) => {
  const { id } = req.params
  const { serviceProvider } = req.body

  try {
    if (!serviceProvider) {
      return res.status(400).json({ success: false, message: 'Service provider is required' })
    }
    await deleteCourierService(id, serviceProvider)
    res.json({ success: true, message: 'Courier deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to delete courier' })
  }
}
