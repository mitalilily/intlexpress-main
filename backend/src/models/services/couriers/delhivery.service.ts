import axios, { type AxiosRequestConfig } from 'axios'
import qs from 'qs'
import { DelhiveryManifestError, HttpError } from '../../../utils/classes'
import {
  normalizeCourierId,
  resolveDelhiveryShippingMode,
} from '../../../utils/delhiveryCourier'
import {
  type DelhiveryAccountConfig,
  resolveDelhiveryCredentials,
} from '../delhiveryCredentials.service'
import { ShipmentParams } from '../shiprocket.service'
import { resolveDelhiveryReverseQcPayload } from '../../../utils/delhiveryReverseQc'

const parseTimeout = (value: string | undefined, fallbackMs: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs
}

const extractProviderErrorMessage = (value: unknown): string | null => {
  if (!value) return null

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const message = extractProviderErrorMessage(entry)
      if (message) return message
    }
    return null
  }

  if (typeof value === 'object') {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      const message = extractProviderErrorMessage(nestedValue)
      if (message) return message
    }
  }

  return null
}

const isTimeoutError = (err: any) => {
  const message = String(err?.message || '')
    .trim()
    .toLowerCase()

  return (
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ETIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('timed out')
  )
}

const getExistingPickupRequestId = (message: unknown): string | null => {
  const normalized = String(message || '').trim()
  if (!normalized) return null

  const lower = normalized.toLowerCase()
  if (!lower.includes('pickup request') || !lower.includes('already exist')) {
    return null
  }

  return normalized.match(/pickup request\s+(\d+)/i)?.[1] || null
}

const normalizeDelhiveryWeightGrams = (value: unknown, fallbackGrams = 500) => {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallbackGrams

  // Shiplifi stores B2C weights in grams; older integrations may still send kg.
  return numericValue > 50 ? Math.round(numericValue) : Math.round(numericValue * 1000)
}

const delhiveryCancellationResponseText = (value: unknown) => {
  try {
    return JSON.stringify(value || {}).toLowerCase()
  } catch {
    return String(value || '').toLowerCase()
  }
}

const isDelhiveryAlreadyCancelledResponse = (value: unknown) => {
  const responseText = delhiveryCancellationResponseText(value)
  return responseText.includes('already cancelled') || responseText.includes('already canceled')
}

const DEFAULT_DELHIVERY_B2B_AUTH_API_BASE = 'https://ltl-clients-api.delhivery.com'

const getDelhiveryCancellationMessage = (value: unknown): string | null => {
  if (!value) return null

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? normalized : null
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const message = getDelhiveryCancellationMessage(entry)
      if (message) return message
    }
    return null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['message', 'remark', 'remarks', 'responseMsg', 'ReturnMessage']) {
      const direct = record[key]
      if (typeof direct === 'string' && direct.trim()) return direct.trim()
    }

    for (const key of ['packages', 'package', 'response', 'data']) {
      const nested = record[key]
      if (nested) {
        const message = getDelhiveryCancellationMessage(nested)
        if (message) return message
      }
    }
  }

  return null
}

export const isDelhiveryCancellationAccepted = (value: unknown) => {
  const result = value as any
  const responseText = delhiveryCancellationResponseText(value)
  const numericStatus = Number(result?.status ?? result?.responseCode ?? result?.code)
  const alreadyCancelled = isDelhiveryAlreadyCancelledResponse(value)
  const acceptedText =
    responseText.includes('cancelled') ||
    responseText.includes('canceled') ||
    responseText.includes('cancellation initiated') ||
    responseText.includes('cancellation accepted') ||
    responseText.includes('cancellation request accepted') ||
    responseText.includes('marked for cancellation')
  const rejectedText =
    responseText.includes('not accepted') ||
    responseText.includes('not found') ||
    responseText.includes('invalid') ||
    responseText.includes('failed') ||
    responseText.includes('failure') ||
    responseText.includes('error')

  return (
    alreadyCancelled ||
    result?.success === true ||
    result?.Success === true ||
    result?.status === true ||
    String(result?.status || '').toLowerCase() === 'success' ||
    String(result?.Status || '').toLowerCase() === 'success' ||
    (Number.isFinite(numericStatus) && numericStatus >= 200 && numericStatus < 300) ||
    result?.response?.status === true ||
    (acceptedText && !rejectedText)
  )
}

const normalizeDelhiveryB2BAuthApiBase = (value: unknown) => {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/, '')

  if (normalized.toLowerCase().includes('ltl-clients-api')) {
    return normalized
  }

  return DEFAULT_DELHIVERY_B2B_AUTH_API_BASE
}

const extractDelhiveryB2BToken = (value: unknown): string => {
  if (!value) return ''

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.split('.').length === 3 ? normalized : ''
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const token = extractDelhiveryB2BToken(entry)
      if (token) return token
    }
    return ''
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of [
      'token',
      'jwt',
      'access_token',
      'accessToken',
      'bearer_token',
      'bearerToken',
      'auth_token',
      'authToken',
    ]) {
      const direct = record[key]
      if (typeof direct === 'string' && direct.trim()) return direct.trim()
    }

    for (const nested of Object.values(record)) {
      const token = extractDelhiveryB2BToken(nested)
      if (token) return token
    }
  }

  return ''
}

export const triggerDelhiveryForgotPassword = async ({
  username,
  apiBase,
}: {
  username: string
  apiBase?: string | null
}) => {
  const normalizedUsername = String(username || '').trim()
  if (!normalizedUsername) {
    throw new HttpError(400, 'Delhivery username is required to reset the password.')
  }

  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)
  const requestBody: Record<string, string> = {
    username: normalizedUsername,
  }

  if (resolvedApiBase.toLowerCase().includes('ltl-clients-api-dev')) {
    requestBody.redirect_url = 'https://www.delhivery.com'
  }

  try {
    const response = await axios.post(`${resolvedApiBase}/forgot-password`, requestBody, {
      headers: {
        Connection: 'keep-alive',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    })

    return {
      apiBase: resolvedApiBase,
      status: response.status,
      data: response.data,
    }
  } catch (err: any) {
    const providerMessage =
      extractProviderErrorMessage(err?.response?.data) ||
      err?.response?.data?.message ||
      err?.message ||
      'Delhivery forgot-password request failed'

    throw new HttpError(Number(err?.response?.status) || 502, providerMessage)
  }
}

export const loginDelhiveryB2B = async ({
  username,
  password,
  apiBase,
}: {
  username: string
  password: string
  apiBase?: string | null
}) => {
  const normalizedUsername = String(username || '').trim()
  const normalizedPassword = String(password || '').trim()

  if (!normalizedUsername || !normalizedPassword) {
    throw new HttpError(400, 'Delhivery B2B username and password are required for login.')
  }

  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)

  try {
    const response = await axios.post(
      `${resolvedApiBase}/ums/login`,
      {
        username: normalizedUsername,
        password: normalizedPassword,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30000,
      },
    )

    const token = extractDelhiveryB2BToken(response.data)
    if (!token) {
      throw new HttpError(502, 'Delhivery login succeeded but did not return a bearer token.')
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    return {
      apiBase: resolvedApiBase,
      status: response.status,
      token,
      tokenType: 'Bearer',
      expiresAt,
      data: response.data,
    }
  } catch (err: any) {
    if (err instanceof HttpError) throw err

    const providerMessage =
      extractProviderErrorMessage(err?.response?.data) ||
      err?.response?.data?.message ||
      err?.message ||
      'Delhivery B2B login request failed'

    throw new HttpError(Number(err?.response?.status) || 502, providerMessage)
  }
}

const buildDelhiveryB2BAuthHeaders = (token: string, extraHeaders: Record<string, string> = {}) => ({
  Authorization: `Bearer ${String(token || '').trim()}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...extraHeaders,
})

const ensureDelhiveryB2BToken = (token: string) => {
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) {
    throw new HttpError(400, 'Delhivery B2B bearer token is required. Run login first.')
  }
  return normalizedToken
}

export const logoutDelhiveryB2B = async ({
  token,
  apiBase,
}: {
  token: string
  apiBase?: string | null
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)

  try {
    const response = await axios.get(`${resolvedApiBase}/ums/logout`, {
      headers: buildDelhiveryB2BAuthHeaders(normalizedToken),
      timeout: 30000,
    })

    return {
      apiBase: resolvedApiBase,
      status: response.status,
      data: response.data,
    }
  } catch (err: any) {
    const providerMessage =
      extractProviderErrorMessage(err?.response?.data) ||
      err?.response?.data?.message ||
      err?.message ||
      'Delhivery B2B logout request failed'

    throw new HttpError(Number(err?.response?.status) || 502, providerMessage)
  }
}

export const checkDelhiveryB2BServiceability = async ({
  token,
  apiBase,
  pincode,
  weight,
}: {
  token: string
  apiBase?: string | null
  pincode: string
  weight?: string | number | null
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const normalizedPincode = String(pincode || '').trim()
  if (!normalizedPincode) {
    throw new HttpError(400, 'Consignee pincode is required for Delhivery B2B serviceability.')
  }

  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)
  const response = await axios.get(
    `${resolvedApiBase}/pincode-service/${encodeURIComponent(normalizedPincode)}`,
    {
      headers: buildDelhiveryB2BAuthHeaders(normalizedToken),
      params: weight ? { weight } : undefined,
      timeout: 30000,
    },
  )

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

export const estimateDelhiveryB2BTat = async ({
  token,
  apiBase,
  originPin,
  destinationPin,
  requestId,
}: {
  token: string
  apiBase?: string | null
  originPin: string
  destinationPin: string
  requestId?: string | null
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const normalizedOriginPin = String(originPin || '').trim()
  const normalizedDestinationPin = String(destinationPin || '').trim()
  if (!normalizedOriginPin || !normalizedDestinationPin) {
    throw new HttpError(400, 'Origin and destination pincodes are required for Delhivery B2B TAT.')
  }

  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)
  const response = await axios.get(`${resolvedApiBase}/tat/estimate`, {
    headers: buildDelhiveryB2BAuthHeaders(
      normalizedToken,
      requestId ? { 'X-Request-Id': String(requestId).trim() } : {},
    ),
    params: {
      origin_pin: normalizedOriginPin,
      destination_pin: normalizedDestinationPin,
    },
    timeout: 30000,
  })

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

export const estimateDelhiveryB2BFreight = async ({
  token,
  apiBase,
  payload,
}: {
  token: string
  apiBase?: string | null
  payload: Record<string, any>
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)

  const response = await axios.post(`${resolvedApiBase}/freight/estimate`, payload, {
    headers: buildDelhiveryB2BAuthHeaders(normalizedToken),
    timeout: 30000,
  })

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

export const getDelhiveryB2BFreightCharges = async ({
  token,
  apiBase,
  lrns,
}: {
  token: string
  apiBase?: string | null
  lrns: string
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const normalizedLrns = String(lrns || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 25)
    .join(',')

  if (!normalizedLrns) {
    throw new HttpError(400, 'At least one LRN is required for Delhivery freight charges.')
  }

  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)
  const response = await axios.get(
    `${resolvedApiBase}/lrn/freight-breakup/lrns=${encodeURIComponent(normalizedLrns)}`,
    {
      headers: buildDelhiveryB2BAuthHeaders(normalizedToken),
      timeout: 30000,
    },
  )

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

export const createDelhiveryB2BClientWarehouse = async ({
  token,
  apiBase,
  payload,
}: {
  token: string
  apiBase?: string | null
  payload: Record<string, any>
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)

  const response = await axios.post(`${resolvedApiBase}/client-warehouse/create/`, payload, {
    headers: buildDelhiveryB2BAuthHeaders(normalizedToken),
    timeout: 30000,
  })

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

export const updateDelhiveryB2BClientWarehouse = async ({
  token,
  apiBase,
  payload,
}: {
  token: string
  apiBase?: string | null
  payload: Record<string, any>
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)

  const response = await axios.patch(`${resolvedApiBase}/client-warehouse/update/`, payload, {
    headers: buildDelhiveryB2BAuthHeaders(normalizedToken),
    timeout: 30000,
  })

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

const appendDelhiveryManifestField = (form: any, key: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    form.append(key, String(value))
    return
  }

  form.append(
    key,
    JSON.stringify(value),
  )
}

export const extractDelhiveryB2BJobId = (value: unknown): string => {
  if (!value) return ''

  if (typeof value === 'string') {
    return String(value).trim()
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const id = extractDelhiveryB2BJobId(entry)
      if (id) return id
    }
    return ''
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['job_id', 'jobId', 'request_id', 'requestId']) {
      const direct = record[key]
      if (typeof direct === 'string' && direct.trim()) return direct.trim()
    }

    for (const nested of Object.values(record)) {
      const id = extractDelhiveryB2BJobId(nested)
      if (id) return id
    }
  }

  return ''
}

export const createDelhiveryB2BShipment = async ({
  token,
  apiBase,
  payload,
}: {
  token: string
  apiBase?: string | null
  payload: Record<string, any>
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)
  const form = new (globalThis as any).FormData()

  Object.entries(payload || {}).forEach(([key, value]) => {
    appendDelhiveryManifestField(form, key, value)
  })

  const response = await axios.post(`${resolvedApiBase}/manifest`, form, {
    headers: {
      Authorization: `Bearer ${normalizedToken}`,
      ...(typeof form.getHeaders === 'function' ? form.getHeaders() : {}),
    },
    timeout: 60000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

export const getDelhiveryB2BShipmentStatus = async ({
  token,
  apiBase,
  jobId,
}: {
  token: string
  apiBase?: string | null
  jobId: string
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const normalizedJobId = String(jobId || '').trim()
  if (!normalizedJobId) {
    throw new HttpError(400, 'job_id is required for Delhivery B2B shipment status.')
  }

  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)
  const response = await axios.get(`${resolvedApiBase}/manifest`, {
    headers: buildDelhiveryB2BAuthHeaders(normalizedToken),
    params: { job_id: normalizedJobId },
    timeout: 30000,
  })

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

export const updateDelhiveryB2BShipment = async ({
  token,
  apiBase,
  lrn,
  payload,
}: {
  token: string
  apiBase?: string | null
  lrn: string
  payload: Record<string, any>
}) => {
  const normalizedToken = ensureDelhiveryB2BToken(token)
  const normalizedLrn = String(lrn || '').trim()
  if (!normalizedLrn) {
    throw new HttpError(400, 'LRN is required for Delhivery B2B shipment update.')
  }

  const resolvedApiBase = normalizeDelhiveryB2BAuthApiBase(apiBase)
  const form = new (globalThis as any).FormData()

  Object.entries(payload || {}).forEach(([key, value]) => {
    appendDelhiveryManifestField(form, key, value)
  })

  const response = await axios.put(`${resolvedApiBase}/lrn/update/${encodeURIComponent(normalizedLrn)}`, form, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${normalizedToken}`,
      ...(typeof form.getHeaders === 'function' ? form.getHeaders() : {}),
    },
    timeout: 60000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })

  return {
    apiBase: resolvedApiBase,
    status: response.status,
    data: response.data,
  }
}

export class DelhiveryService {
  private apiBase = 'https://track.delhivery.com'
  private token = ''
  private clientName = ''
  private resolvedAccount: DelhiveryAccountConfig | null = null
  private readonly requestTimeoutMs = parseTimeout(process.env.DELHIVERY_REQUEST_TIMEOUT_MS, 30000)
  private readonly labelTimeoutMs = parseTimeout(process.env.DELHIVERY_LABEL_TIMEOUT_MS, 15000)
  private readonly resolutionContext: {
    preferredAccountCode?: string | null
    pickupLocationId?: string | null
    pickupLocationName?: string | null
    order?: Record<string, any> | null
  }

  constructor(
    resolutionContext: {
      preferredAccountCode?: string | null
      pickupLocationId?: string | null
      pickupLocationName?: string | null
      order?: Record<string, any> | null
    } = {},
  ) {
    this.resolutionContext = resolutionContext
  }

  private async ensureCredentials() {
    const credentials = await resolveDelhiveryCredentials(this.resolutionContext)
    this.apiBase = credentials.apiBase
    this.token = credentials.apiKey
    this.clientName = credentials.clientName
    this.resolvedAccount = credentials
  }

  async getResolvedAccount() {
    await this.ensureCredentials()
    return this.resolvedAccount
  }

  private get headers() {
    return {
      Authorization: `Token ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  private async postFormEncoded(path: string, payload: unknown) {
    await this.ensureCredentials()
    const encodedData = qs.stringify({
      format: 'json',
      data: JSON.stringify(payload),
    })

    return axios.post(`${this.apiBase}${path}`, encodedData, {
      headers: {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: this.requestTimeoutMs,
    })
  }

  private async getWithTimeout(url: string, config: AxiosRequestConfig = {}, timeoutMs?: number) {
    return axios.get(url, {
      ...config,
      timeout: timeoutMs ?? this.requestTimeoutMs,
    })
  }

  private async postWithTimeout(
    url: string,
    data: unknown,
    config: AxiosRequestConfig = {},
    timeoutMs?: number,
  ) {
    return axios.post(url, data, {
      ...config,
      timeout: timeoutMs ?? this.requestTimeoutMs,
    })
  }

  // 🔹 1. Check Serviceability
  async checkB2CServiceability(pincode: string) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/c/api/pin-codes/json/?filter_codes=${pincode}`
      const res = await this.getWithTimeout(url, { headers: this.headers })

      // Log the full response structure
      console.log('📦 Delhivery Serviceability API Response:', {
        url,
        status: res.status,
        data: JSON.stringify(res.data, null, 2),
        dataType: typeof res.data,
        isArray: Array.isArray(res.data),
        keys: res.data ? Object.keys(res.data) : [],
      })

      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery serviceability error:', {
        pincode,
        status: err.response?.status,
        data: JSON.stringify(err.response?.data, null, 2),
        message: err.message,
      })
      throw new Error('Failed to fetch Delhivery serviceability')
    }
  }

  // 🔹 2. Expected TAT (Transit Time)
  async checkHeavyPincodeServiceability(pincode: string, productType: string = 'Heavy') {
    try {
      await this.ensureCredentials()
      const query = qs.stringify({
        product_type: productType,
        pincode,
      })
      const url = `${this.apiBase}/api/dc/fetch/serviceability/pincode?${query}`
      const res = await this.getWithTimeout(url, { headers: this.headers })

      console.log('ðŸ“¦ Delhivery Heavy Serviceability API Response:', {
        url,
        status: res.status,
        data: JSON.stringify(res.data, null, 2),
        dataType: typeof res.data,
        isArray: Array.isArray(res.data),
        keys: res.data ? Object.keys(res.data) : [],
      })

      return res.data
    } catch (err: any) {
      console.error('âŒ Delhivery heavy serviceability error:', {
        pincode,
        productType,
        status: err.response?.status,
        data: JSON.stringify(err.response?.data, null, 2),
        message: err.message,
      })
      throw new Error('Failed to fetch Delhivery heavy serviceability')
    }
  }

  async checkServiceability(
    input:
      | string
      | {
          pincode: string
          productType?: string | null
        },
  ) {
    const pincode = typeof input === 'string' ? input : input?.pincode
    const productType = typeof input === 'string' ? '' : String(input?.productType || '').trim()

    if (productType.toLowerCase() === 'heavy') {
      return this.checkHeavyPincodeServiceability(pincode, productType)
    }

    return this.checkB2CServiceability(pincode)
  }

  async getExpectedTAT(params: {
    origin: string
    destination: string
    mot?: 'S' | 'E' | 'N'
    pdt?: 'B2B' | 'B2C' | ''
    expectedPickupDate?: string | null
  }) {
    try {
      await this.ensureCredentials()
      const query = qs.stringify({
        origin_pin: params.origin,
        destination_pin: params.destination,
        mot: params.mot || 'S',
        ...(params.pdt !== undefined ? { pdt: params.pdt } : {}),
        ...(params.expectedPickupDate
          ? { expected_pickup_date: params.expectedPickupDate }
          : {}),
      })
      const url = `${this.apiBase}/api/dc/expected_tat?${query}`
      const res = await this.getWithTimeout(url, { headers: this.headers })
      const tat = res.data?.data?.tat
      return typeof tat === 'number' || typeof tat === 'string' ? Number(tat) : null
    } catch (err: any) {
      console.error('Delhivery TAT API error:', err.response?.data || err.message)
      return null
    }
  }

  // 🔹 3. Fetch Waybills
  async fetchWaybills(count: number = 10) {
    try {
      await this.ensureCredentials()
      const normalizedCount = Math.max(1, Number(count || 1))
      const isBulk = normalizedCount > 1
      const path = isBulk ? '/waybill/api/bulk/json/' : '/waybill/api/fetch/json/'
      const query = qs.stringify({
        cl: this.clientName,
        token: this.token,
        ...(isBulk ? { count: normalizedCount } : {}),
      })
      const url = `${this.apiBase}${path}?${query}`
      const res = await this.getWithTimeout(url, { headers: this.headers })
      return res.data?.waybill ?? res.data?.waybills ?? res.data
    } catch (err: any) {
      console.error('Delhivery waybill fetch error:', err.response?.data || err.message)
      throw new Error('Failed to fetch Delhivery waybill')
    }
  }

  // 🔹 4. Create Shipment (Manifestation)
  async createShipment(params: ShipmentParams, waybill?: string) {
    try {
      const normalizedCourierId = normalizeCourierId(params.courier_id)
      if (normalizedCourierId === null) {
        throw new HttpError(
          400,
          'Delhivery courier_id is required for Air/Express or Surface bookings.',
        )
      }
      const shippingMode = resolveDelhiveryShippingMode({
        courierId: normalizedCourierId,
        mode: params.shipping_mode,
        courierName: params.courier_partner,
      })
      if (!shippingMode) {
        throw new HttpError(
          400,
          `Invalid Delhivery courier selection: courier_id ${normalizedCourierId} does not map to Air/Express or Surface.`,
        )
      }

      const sanitizeString = (value?: string | null) => {
        if (!value) return ''
        return String(value).trim()
      }
      const sanitizePhone = (value?: string | null) => {
        const digits = String(value || '').replace(/\\D/g, '')
        return digits.length >= 10 ? digits.slice(-10) : digits
      }
      const sanitizePincode = (value?: string | number | null) => {
        if (value === undefined || value === null) return ''
        return String(value).trim()
      }
      const sanitizeBoolean = (value?: boolean | string | number | null) => {
        if (value === undefined || value === null) return undefined
        if (typeof value === 'boolean') return value
        const normalized = String(value).trim().toLowerCase()
        return ['true', '1', 'yes', 'y'].includes(normalized)
      }
      const normalizePositiveNumber = (value: unknown) => {
        const numericValue = Number(value)
        return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined
      }

      const pickup = params.pickup || ({} as ShipmentParams['pickup'])
      const consignee = params.consignee || ({} as ShipmentParams['consignee'])
      const boxes = Array.isArray(params.boxes) ? params.boxes : []
      const orderNumber = sanitizeString(params.order_number)
      const invoiceNumber = sanitizeString(params.invoice_number)
      const pickupDate = sanitizeString(params.pickup_date || pickup.pickup_date)
      const pickupTime = sanitizeString(params.pickup_time || pickup.pickup_time)
      const resolvedInvoiceNumber = invoiceNumber || orderNumber
      const orderAmount = Number(params.order_amount ?? 0)
      const orderItems = Array.isArray(params.order_items) ? params.order_items : []
      const hsnCodes = Array.from(
        new Set(
          orderItems
            .map((item) => (item?.hsn || item?.hsnCode || '').toString().trim())
            .filter((code) => code.length > 0),
        ),
      )

      if (!orderNumber) {
        throw new HttpError(400, 'order_number is required to create a Delhivery shipment.')
      }
      if (!invoiceNumber) {
        console.warn(
          `ℹ️ Delhivery invoice_number missing for order ${orderNumber}; using order_number as fallback.`,
        )
      }
      // if (!invoiceNumber) {
      //   throw new HttpError(
      //     400,
      //     'invoice_number (invoice_reference) is mandatory for Delhivery B2C manifests. Please provide the seller invoice number.',
      //   )
      // }
      // if (!hsnCodes.length) {
      //   throw new HttpError(
      //     400,
      //     'Delhivery requires HSN/SAC codes for at least one of the products you are shipping. Attach HSN codes to your order items.',
      //   )
      // }
      if (orderAmount <= 0 || Number.isNaN(orderAmount)) {
        throw new HttpError(
          400,
          'order_amount is required and must be a positive number when booking with Delhivery.',
        )
      }
      const pickupAddressParts = [
        sanitizeString(pickup.address),
        sanitizeString(pickup.address_2),
      ].filter((part) => part.length > 0)
      const pickupAddress =
        pickupAddressParts.length > 0
          ? pickupAddressParts.join(', ')
          : sanitizeString(pickup.warehouse_name)

      const sellerName = sanitizeString(params.company?.name || pickup.name || 'IntleExpress')
      const sellerGst = sanitizeString(params.company?.gst || pickup.gst_number || '')
      const productNames = orderItems
        .map((item) => sanitizeString(item?.name))
        .filter((name) => name.length > 0)
      const productsDesc = productNames.length ? productNames.join(', ') : 'General Merchandise'

      const consigneePhone = sanitizePhone(consignee.phone)
      if (!consigneePhone) {
        throw new HttpError(
          400,
          'Consignee phone must contain at least 10 digits for Delhivery shipments.',
        )
      }
      const pickupPhone = sanitizePhone(pickup.phone)
      if (!pickupPhone) {
        throw new HttpError(400, 'Valid pickup phone is required for Delhivery manifests.')
      }

      const orderDate =
        params.order_date instanceof Date
          ? params.order_date.toISOString().split('T')[0]
          : sanitizeString(params.order_date) || new Date().toISOString().split('T')[0]
      const invoiceDate =
        params.invoice_date && sanitizeString(params.invoice_date)
          ? sanitizeString(params.invoice_date)
          : orderDate
      const paymentMode =
        params.payment_type === 'cod'
          ? 'COD'
          : params.payment_type === 'reverse'
            ? 'Pickup'
            : params.payment_type === 'replacement'
              ? 'REPL'
              : 'Prepaid'
      const codAmount = paymentMode === 'COD' ? orderAmount : 0
      const packageWeightGrams = normalizeDelhiveryWeightGrams(params.package_weight)
      const defaultShipmentLength = Number(params.package_length ?? 10)
      const defaultShipmentWidth = Number(params.package_breadth ?? 10)
      const defaultShipmentHeight = Number(params.package_height ?? 10)

      const manifestShipment: Record<string, any> = {
        order: orderNumber,
        order_date: orderDate,
        name: sanitizeString(consignee.name),
        phone: consigneePhone,
        add: sanitizeString(consignee.address),
        city: sanitizeString(consignee.city),
        state: sanitizeString(consignee.state),
        pin: sanitizePincode(consignee.pincode),
        country: sanitizeString(params.country) || 'India',
        payment_mode: paymentMode,
        cod_amount: codAmount,
        total_amount: orderAmount,
        products_desc: productsDesc,
        hsn_code: hsnCodes.join(', '),
        weight: packageWeightGrams,
        shipment_length: defaultShipmentLength,
        shipment_width: defaultShipmentWidth,
        shipment_height: defaultShipmentHeight,
        seller_name: sellerName,
        seller_add: pickupAddress,
        seller_city: sanitizeString(pickup.city),
        seller_state: sanitizeString(pickup.state),
        seller_pin: sanitizePincode(pickup.pincode),
        seller_phone: pickupPhone,
        seller_gst_tin: sellerGst,
        seller_inv: resolvedInvoiceNumber,
        invoice_reference: resolvedInvoiceNumber,
        invoice_date: invoiceDate,
        pickup_location: sanitizeString(pickup.warehouse_name) || 'Default Warehouse',
        pickup_address: pickupAddress,
        pickup_city: sanitizeString(pickup.city),
        pickup_state: sanitizeString(pickup.state),
        pickup_pin: sanitizePincode(pickup.pincode),
        pickup_phone: pickupPhone,
        pickup_country: sanitizeString(params.country) || 'India',
        pickup_date: pickupDate || undefined,
        pickup_time: pickupTime || undefined,
        shipping_mode: shippingMode,
        client: this.clientName || sellerName,
        client_name: this.clientName || sellerName,
        client_gst_tin: sellerGst,
        waybill: waybill || undefined,
      }

      if (params.transport_speed) {
        manifestShipment.transport_speed = sanitizeString(params.transport_speed)
      }
      if (params.address_type) {
        manifestShipment.address_type = sanitizeString(params.address_type)
      }
      const ewbnValue =
        params.ewbn || params.ewb || params.ewbn_number || params.ewaybill_number || undefined
      if (ewbnValue) {
        manifestShipment.ewbn = sanitizeString(ewbnValue)
      }
      if (params.dangerous_good !== undefined) {
        manifestShipment.dangerous_good = sanitizeBoolean(params.dangerous_good)
      }
      if (params.fragile_shipment !== undefined) {
        manifestShipment.fragile_shipment = sanitizeBoolean(params.fragile_shipment)
      }
      if (params.plastic_packaging !== undefined) {
        manifestShipment.plastic_packaging = sanitizeBoolean(params.plastic_packaging)
      }
      if (params.quantity !== undefined && params.quantity !== null) {
        manifestShipment.quantity = sanitizeString(String(params.quantity))
      }
      if (params.country) {
        manifestShipment.country = sanitizeString(params.country)
      }

      const resolvedReturnAddress =
        params.rto && params.is_rto_different === 'yes'
          ? params.rto
          : paymentMode === 'REPL'
            ? (params.rto ?? params.pickup)
            : null

      if (resolvedReturnAddress) {
        Object.assign(manifestShipment, {
          return_name: resolvedReturnAddress.name,
          return_add: resolvedReturnAddress.address,
          return_address: resolvedReturnAddress.address,
          return_city: resolvedReturnAddress.city,
          return_state: resolvedReturnAddress.state,
          return_pin: resolvedReturnAddress.pincode,
          return_phone: resolvedReturnAddress.phone,
          return_country: 'India',
        })
      }

      const isMpsShipment = Boolean(params.mps || boxes.length > 1)
      let shipments: Record<string, any>[] = [manifestShipment]

      if (isMpsShipment) {
        const normalizedBoxes = boxes.length ? boxes : [{}]
        const waybillList = normalizedBoxes.map((box, index) =>
          sanitizeString(
            box?.waybill ||
              box?.awb ||
              box?.awb_number ||
              box?.tracking_number ||
              (index === 0 ? waybill : ''),
          ),
        )
        const missingWaybillIndex = waybillList.findIndex((value) => !value)
        if (missingWaybillIndex >= 0) {
          throw new HttpError(
            400,
            'Delhivery MPS requires a prefetched waybill for every box. Pass boxes[n].waybill for each package.',
          )
        }

        const masterWaybill = sanitizeString(waybill || waybillList[0])
        const boxCount = normalizedBoxes.length
        const fallbackWeightGrams = Math.max(1, Math.round(packageWeightGrams / boxCount))

        shipments = normalizedBoxes.map((box, index) => {
          const weightCandidate =
            box?.weight ??
            box?.weightKg ??
            box?.weight_kg ??
            box?.weightInKg ??
            box?.package_weight ??
            box?.dead_weight
          const shipmentLength =
            normalizePositiveNumber(
              box?.length ?? box?.lengthCm ?? box?.length_cm ?? box?.package_length,
            ) ?? defaultShipmentLength
          const shipmentWidth =
            normalizePositiveNumber(
              box?.breadth ??
                box?.breadthCm ??
                box?.breadth_cm ??
                box?.width ??
                box?.widthCm ??
                box?.package_breadth,
            ) ?? defaultShipmentWidth
          const shipmentHeight =
            normalizePositiveNumber(
              box?.height ?? box?.heightCm ?? box?.height_cm ?? box?.package_height,
            ) ?? defaultShipmentHeight

          return {
            ...manifestShipment,
            shipment_type: 'MPS',
            master_id: masterWaybill,
            mps_children: boxCount,
            mps_amount: codAmount,
            waybill: waybillList[index],
            weight: normalizeDelhiveryWeightGrams(weightCandidate, fallbackWeightGrams),
            shipment_length: shipmentLength,
            shipment_width: shipmentWidth,
            shipment_height: shipmentHeight,
            quantity: sanitizeString(String(box?.quantity ?? box?.qty ?? params.quantity ?? 1)),
          }
        })
      }

      const payload = {
        shipments,
        pickup_location: {
          name: sanitizeString(pickup.warehouse_name) || 'Default Warehouse',
        },
      }

      console.log('📤 Delhivery createShipment payload summary', {
        order: orderNumber,
        pickup_location: payload.pickup_location.name,
        pickup_date: payload.shipments[0].pickup_date ?? null,
        pickup_time: payload.shipments[0].pickup_time ?? null,
        weight_g: packageWeightGrams,
        payment_mode: paymentMode,
        hsn_present: hsnCodes.length,
        invoice_number: invoiceNumber,
        shipping_mode: shippingMode,
        cod_amount: codAmount,
        is_mps: isMpsShipment,
        packages_count: payload.shipments.length,
      })

      const res = await this.postFormEncoded('/api/cmu/create.json', payload)
      const responseData = res.data

      const packages: any[] = Array.isArray(responseData?.packages)
        ? responseData.packages
        : responseData?.packages
          ? [responseData.packages]
          : []

      const normalizedStatus = (value?: string) => (value || '').toLowerCase()
      const normalizeRemarks = (remarks: unknown): string[] => {
        if (!remarks) return []
        if (Array.isArray(remarks)) {
          return remarks
            .flatMap((entry) => normalizeRemarks(entry))
            .filter((entry) => entry.trim().length > 0)
        }
        if (typeof remarks === 'string') {
          return [remarks.trim()].filter(Boolean)
        }
        if (typeof remarks === 'object') {
          return Object.values(remarks as Record<string, unknown>)
            .flatMap((entry) => normalizeRemarks(entry))
            .filter((entry) => entry.trim().length > 0)
        }
        return [String(remarks).trim()].filter(Boolean)
      }
      const overallStatus = normalizedStatus(responseData?.status)
      const packageFailures = packages.filter(
        (pkg) =>
          normalizedStatus(pkg?.status) === 'fail' || pkg?.serviceable === false || !pkg?.waybill,
      )
      const packageFailuresWithRemarks = packageFailures.map((pkg) => ({
        ...pkg,
        remarks: normalizeRemarks(pkg?.remarks),
      }))
      const successPackage = packages.find(
        (pkg) =>
          pkg?.waybill && pkg?.serviceable !== false && normalizedStatus(pkg?.status) !== 'fail',
      )

      if (
        overallStatus === 'fail' ||
        responseData?.success === false ||
        responseData?.serviceable === false ||
        !successPackage
      ) {
        console.error('❌ Delhivery manifest rejected', {
          order: orderNumber,
          response: responseData,
          packageFailures: packageFailuresWithRemarks,
        })

        const failureReason =
          responseData?.message ||
          responseData?.status_message ||
          normalizeRemarks(responseData?.rmk).join(' | ') ||
          packageFailuresWithRemarks
            .map((pkg) => {
              const joinedRemarks = pkg.remarks.join(' | ')
              return (
                joinedRemarks ||
                pkg?.message ||
                pkg?.reason ||
                pkg?.rmk ||
                `status=${pkg?.status ?? 'unknown'}`
              )
            })
            .filter(Boolean)
            .join(' | ') ||
          'Delhivery reported a failure during shipment creation.'
        throw new DelhiveryManifestError(502, failureReason, responseData)
      }

      const responseShippingMode =
        responseData?.shipping_mode ??
        successPackage?.shipping_mode ??
        successPackage?.service_mode ??
        successPackage?.service_type ??
        successPackage?.mode ??
        null

      console.log('📤 Delhivery API response service', {
        order: orderNumber,
        requested_shipping_mode: shippingMode,
        response_shipping_mode: responseShippingMode,
        response_package_keys: successPackage ? Object.keys(successPackage) : [],
      })

      let sortCode: string | null = null
      if (successPackage) {
        sortCode =
          (successPackage.sort_code ||
            successPackage.sortCode ||
            successPackage.routing_code ||
            successPackage.routingCode) ??
          null
      }

      if (sortCode && successPackage) {
        successPackage.sort_code = sortCode
      }

      return responseData
    } catch (err: any) {
      console.error('Delhivery shipment error:', err.response?.data || err.message)
      if (err instanceof HttpError) {
        throw err
      }
      throw new Error('Delhivery shipment creation failed')
    }
  }

  // 🔹 6. Cancel Shipment
  async cancelShipment(waybill: string) {
    const normalizedWaybill = String(waybill || '').trim()
    if (!normalizedWaybill) {
      throw new HttpError(400, 'Delhivery AWB number is required for cancellation')
    }

    try {
      await this.ensureCredentials()
      console.log('🚚 Delhivery Cancel Shipment Request:', {
        waybill: normalizedWaybill,
        apiBase: this.apiBase,
      })

      const res = await this.postWithTimeout(
        `${this.apiBase}/api/p/edit`,
        { waybill: normalizedWaybill, cancellation: 'true' },
        {
          headers: {
            Authorization: `Token ${this.token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )

      console.log('📥 Delhivery Cancel Shipment Response:', {
        status: res.status,
        data: JSON.stringify(res.data, null, 2),
        success: res.data?.success,
        Success: res.data?.Success,
        statusField: res.data?.status,
        message: res.data?.message,
      })

      if (!isDelhiveryCancellationAccepted(res.data)) {
        const providerMessage =
          getDelhiveryCancellationMessage(res.data) ||
          extractProviderErrorMessage(res.data) ||
          'Delhivery cancellation not accepted'
        throw new Error(providerMessage)
      }

      return {
        success: true,
        status: 'success',
        provider: 'delhivery',
        awb_number: normalizedWaybill,
        alreadyCancelled: isDelhiveryAlreadyCancelledResponse(res.data),
        message:
          getDelhiveryCancellationMessage(res.data) ||
          (isDelhiveryAlreadyCancelledResponse(res.data)
            ? 'Delhivery shipment was already cancelled'
            : 'Delhivery cancellation accepted'),
        provider_response: res.data,
      }
    } catch (err: any) {
      console.error('❌ Delhivery cancellation error:', {
        waybill: normalizedWaybill,
        status: err.response?.status,
        data: JSON.stringify(err.response?.data, null, 2),
        message: err.message,
        stack: err.stack,
      })
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery cancellation failed'
      throw new Error(providerMessage)
    }
  }

  // 🔹 7. Track Shipment
  async trackShipment(
    input:
      | string
      | {
          waybill?: string | string[]
          refIds?: string | string[]
        },
  ) {
    await this.ensureCredentials()
    const waybill =
      typeof input === 'string'
        ? String(input || '').trim()
        : Array.isArray(input?.waybill)
          ? input.waybill.filter(Boolean).join(',')
          : String(input?.waybill || '').trim()
    const refIds =
      typeof input === 'string'
        ? ''
        : Array.isArray(input?.refIds)
          ? input.refIds.filter(Boolean).join(',')
          : String(input?.refIds || '').trim()
    const query = qs.stringify({
      ...(waybill ? { waybill } : {}),
      ...(refIds ? { ref_ids: refIds } : {}),
    })
    const res = await this.getWithTimeout(`${this.apiBase}/api/v1/packages/json/?${query}`, {
      headers: this.headers,
    })
    return res.data
  }

  // 🔹 8. NDR Action (RE-ATTEMPT / PICKUP_RESCHEDULE)
  async submitNdrAction(
    actions: Array<{
      waybill: string
      act: 'RE-ATTEMPT' | 'DEFER_DLV' | 'EDIT_DETAILS' | 'PICKUP_RESCHEDULE'
      action_data?: Record<string, any>
    }>,
  ) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/p/update`
      const payload = actions.map((action) => {
        const mappedAct = action.act === 'DEFER_DLV' ? 'PICKUP_RESCHEDULE' : action.act
        const actionData = { ...(action.action_data || {}) } as Record<string, any>

        if (mappedAct === 'PICKUP_RESCHEDULE') {
          const normalizedDeferredDate =
            actionData.deferred_date || actionData.deferment_date || actionData.defermentDate
          if (normalizedDeferredDate) {
            actionData.deferred_date = normalizedDeferredDate
          }
          delete actionData.deferment_date
          delete actionData.defermentDate
        }

        return {
          waybill: action.waybill,
          act: mappedAct,
          ...(Object.keys(actionData).length ? { action_data: actionData } : {}),
        }
      })
      const res = await this.postWithTimeout(url, { data: payload }, { headers: this.headers })
      return res.data // contains UPL id(s)
    } catch (err: any) {
      console.error('Delhivery NDR action error:', err.response?.data || err.message)
      throw new Error('Failed to submit Delhivery NDR action')
    }
  }

  // 🔹 9. Get NDR UPL Status
  async getNdrStatus(uplId: string, verbose: boolean = true) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/cmu/get_bulk_upl/${encodeURIComponent(uplId)}?verbose=${
        verbose ? 'true' : 'false'
      }`
      const res = await this.getWithTimeout(url, { headers: this.headers })
      return res.data
    } catch (err: any) {
      console.error('Delhivery NDR status error:', err.response?.data || err.message)
      throw new Error('Failed to fetch Delhivery NDR status')
    }
  }

  // 🔹 8. Pickup Request (manual scheduling)
  async requestPickup(pickupData: any) {
    await this.ensureCredentials()
    const res = await this.postWithTimeout(`${this.apiBase}/fm/request/new/`, pickupData, {
      headers: this.headers,
    })
    return res.data
  }

  // services/delhivery.service.ts
  async createWarehouse(warehouse: {
    name: string
    registered_name?: string
    phone: string
    email?: string
    address: string
    city: string
    pin: string
    country?: string
    return_address: string
    return_city?: string
    return_pin?: string
    return_state?: string
    return_country?: string
  }) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/backend/clientwarehouse/create/`
      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const res = await this.postWithTimeout(url, warehouse, { headers })
      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery warehouse creation error:', err.response?.data || err.message)
      // Re-throw original error so upstream callers can inspect Delhivery's response
      throw err
    }
  }

  async triggerDelhiveryPickupRequest(pickupLocationName: string, packageCount: number) {
    try {
      // 🔹 Current date in YYYY-MM-DD
      const now = new Date()
      const pickup_date = now.toISOString().split('T')[0]

      // 🔹 Pickup time → 1 hour from now (HH:mm:ss)
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
      const pickup_time = oneHourLater.toTimeString().split(' ')[0] // "HH:mm:ss"

      const payload = {
        pickup_date,
        pickup_time,
        pickup_location: pickupLocationName,
        expected_package_count: packageCount,
      }

      const res = await this.requestPickup(payload)

      if (!res?.success) {
        console.error('❌ Delhivery pickup creation failed:', res)
        throw new Error(res?.message || 'Delhivery pickup request failed')
      }

      console.log(`✅ Pickup request created for ${pickupLocationName} (${packageCount} packages)`)
      return res
    } catch (err: any) {
      console.error('❌ Pickup request creation error:', err.message)
      throw err
    }
  }
  // 🔹 10. Create Reverse Shipment
  // Delhivery reverse shipments are created via the same create.json manifestation API,
  // with `package_type: "Pickup"` and reverse-specific shipment values.
  async createReverseShipment(params: {
    originalAwb: string
    originalOrderId?: string
    consignee: ShipmentParams['consignee']
    pickup: ShipmentParams['pickup']
    rto?: ShipmentParams['rto']
    order_amount?: number
    package_weight?: number
    package_length?: number
    package_breadth?: number
    package_height?: number
    order_items?: ShipmentParams['order_items']
    shipping_mode?: ShipmentParams['shipping_mode']
    transport_speed?: ShipmentParams['transport_speed']
    address_type?: ShipmentParams['address_type']
    invoice_number?: ShipmentParams['invoice_number']
    order_date?: ShipmentParams['order_date']
    dangerous_good?: ShipmentParams['dangerous_good']
    fragile_shipment?: ShipmentParams['fragile_shipment']
    plastic_packaging?: ShipmentParams['plastic_packaging']
    quantity?: ShipmentParams['quantity']
    country?: ShipmentParams['country']
    ewbn?: ShipmentParams['ewbn']
    ewb?: ShipmentParams['ewb']
    ewbn_number?: ShipmentParams['ewbn_number']
    ewaybill_number?: ShipmentParams['ewaybill_number']
    waybill?: string
    qc_type?: ShipmentParams['qc_type']
    custom_qc?: ShipmentParams['custom_qc']
    qc_details?: ShipmentParams['qc_details']
  }) {
    try {
      const sanitizeString = (value?: string | number | null) => {
        if (value === undefined || value === null) return ''
        return String(value).trim()
      }
      const sanitizePhone = (value?: string | null) =>
        String(value || '')
          .replace(/\D/g, '')
          .slice(-10)
      const sanitizeBoolean = (value?: boolean | string | number | null) => {
        if (value === undefined || value === null) return undefined
        if (typeof value === 'boolean') return value
        const normalized = String(value).trim().toLowerCase()
        return ['true', '1', 'yes', 'y'].includes(normalized)
      }
      const normalizePositiveNumber = (value: unknown) => {
        const numericValue = Number(value)
        return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined
      }

      const reverseDrop = params.rto ?? params.pickup
      const pickupAddress = [params.pickup?.address, params.pickup?.address_2]
        .map((part) => sanitizeString(part))
        .filter(Boolean)
        .join(', ')
      const pickupPhone = sanitizePhone(params.pickup?.phone)
      const consigneePhone = sanitizePhone(params.consignee?.phone)
      const orderDate =
        params.order_date instanceof Date
          ? params.order_date.toISOString().split('T')[0]
          : sanitizeString(params.order_date) || new Date().toISOString().split('T')[0]
      const hsnCodes = Array.from(
        new Set(
          (params.order_items || [])
            .map((item) => sanitizeString(item?.hsn || item?.hsnCode))
            .filter(Boolean),
        ),
      )
      const invoiceNumber =
        sanitizeString(params.invoice_number) ||
        sanitizeString(params.originalOrderId) ||
        `REVERSE-${sanitizeString(params.originalAwb)}`
      const ewbnValue =
        params.ewbn || params.ewb || params.ewbn_number || params.ewaybill_number || undefined

      const reversePayload: any = {
        shipments: [
          {
            order: params.originalOrderId || `REVERSE-${params.originalAwb}`,
            order_date: orderDate,
            name: sanitizeString(params.consignee?.name),
            phone: consigneePhone,
            add: sanitizeString(params.consignee?.address),
            city: sanitizeString(params.consignee?.city),
            state: sanitizeString(params.consignee?.state),
            pin: String(params.consignee?.pincode || '')
              .padStart(6, '0')
              .slice(0, 6),
            country: sanitizeString(params.country) || 'India',
            payment_mode: 'Pickup',
            package_type: 'Pickup',
            total_amount: Number(params.order_amount || 0),
            cod_amount: '0',
            products_desc:
              params.order_items?.map((i) => i.name).join(', ') || 'Reverse Pickup Shipment',
            hsn_code: hsnCodes.join(', ') || undefined,
            weight: normalizeDelhiveryWeightGrams(params.package_weight),
            shipment_length: Number(params.package_length ?? 10),
            shipment_width: Number(params.package_breadth ?? 10),
            shipment_height: Number(params.package_height ?? 10),
            pickup_location: sanitizeString(params.pickup?.warehouse_name) || 'Default Warehouse',
            seller_name: sanitizeString(params.pickup?.name) || 'IntleExpress',
            seller_add: pickupAddress || sanitizeString(params.pickup?.warehouse_name),
            seller_city: sanitizeString(params.pickup?.city),
            seller_state: sanitizeString(params.pickup?.state),
            seller_pin: sanitizeString(params.pickup?.pincode),
            seller_phone: pickupPhone,
            seller_inv: invoiceNumber,
            invoice_reference: invoiceNumber,
            pickup_address: pickupAddress || sanitizeString(params.pickup?.warehouse_name),
            pickup_city: sanitizeString(params.pickup?.city),
            pickup_state: sanitizeString(params.pickup?.state),
            pickup_pin: sanitizeString(params.pickup?.pincode),
            pickup_phone: pickupPhone,
            pickup_country: sanitizeString(params.country) || 'India',
            return_name:
              sanitizeString(reverseDrop?.name) || sanitizeString(params.pickup?.name) || 'Return',
            return_add: sanitizeString(reverseDrop?.address),
            return_address: sanitizeString(reverseDrop?.address),
            return_city: sanitizeString(reverseDrop?.city),
            return_state: sanitizeString(reverseDrop?.state),
            return_pin: String(reverseDrop?.pincode ?? '')
              .padStart(6, '0')
              .slice(0, 6),
            return_phone: sanitizePhone(reverseDrop?.phone),
            return_country: sanitizeString(params.country) || 'India',
            shipping_mode: sanitizeString(params.shipping_mode) || undefined,
            transport_speed: sanitizeString(params.transport_speed) || undefined,
            address_type: sanitizeString(params.address_type) || undefined,
            client: this.clientName || sanitizeString(params.pickup?.name) || 'IntleExpress',
            waybill: sanitizeString(params.waybill) || undefined,
          },
        ],
      }

      if (params.order_items && params.order_items.length > 0) {
        reversePayload.shipments[0].products_desc = params.order_items
          .map((item) => item?.name || 'Item')
          .join(', ')
      }
      if (ewbnValue) {
        reversePayload.shipments[0].ewbn = sanitizeString(ewbnValue)
      }
      if (params.dangerous_good !== undefined) {
        reversePayload.shipments[0].dangerous_good = sanitizeBoolean(params.dangerous_good)
      }
      if (params.fragile_shipment !== undefined) {
        reversePayload.shipments[0].fragile_shipment = sanitizeBoolean(params.fragile_shipment)
      }
      if (params.plastic_packaging !== undefined) {
        reversePayload.shipments[0].plastic_packaging = sanitizeBoolean(params.plastic_packaging)
      }
      if (params.quantity !== undefined && params.quantity !== null) {
        reversePayload.shipments[0].quantity = sanitizeString(params.quantity)
      }
      const normalizedQc = resolveDelhiveryReverseQcPayload(
        params.qc_details ??
          (Array.isArray(params.custom_qc)
            ? {
                qc_type: params.qc_type,
                custom_qc: params.custom_qc,
              }
            : null),
      )
      if (normalizedQc.skippedReason) {
        console.warn(`⚠️ [Delhivery] ${normalizedQc.skippedReason}`)
      }
      if (normalizedQc.customQc.length > 0 && normalizedQc.qcType === 'param') {
        reversePayload.shipments[0].qc_type = 'param'
        reversePayload.shipments[0].custom_qc = normalizedQc.customQc
      }

      const res = await this.postFormEncoded('/api/cmu/create.json', reversePayload)

      if (!res.data?.packages?.length) {
        throw new Error('Delhivery reverse shipment creation failed - no packages returned')
      }

      const pkg = res.data.packages[0]
      const delhiveryCost =
        pkg?.charge || pkg?.amount || res.data?.charge || res.data?.amount || null

      return {
        success: true,
        packages: res.data.packages,
        upload_wbn: res.data.upload_wbn,
        shipment_id: res.data.upload_wbn,
        awb_number: pkg.waybill,
        courier_name: 'Delhivery',
        courier_cost: delhiveryCost ? Number(delhiveryCost) : null,
        status: 'booked',
      }
    } catch (err: any) {
      console.error('Delhivery reverse shipment error:', err.response?.data || err.message)
      throw new Error(err?.message || 'Delhivery reverse shipment creation failed')
    }
  }

  async updateWarehouse(data: {
    name: string // warehouse name (case-sensitive, cannot be changed)
    address?: string
    pin?: string
    phone?: string
  }) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/backend/clientwarehouse/edit/`
      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const payload = {
        name: data.name,
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.pin !== undefined ? { pin: data.pin } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      }

      const res = await this.postWithTimeout(url, payload, { headers })
      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery warehouse update error:', err.response?.data || err.message)
      throw new Error('Failed to update Delhivery warehouse')
    }
  }

  async createPickupRequest({
    pickup_date,
    pickup_time,
    pickup_location,
    expected_package_count,
  }: {
    pickup_date: string
    pickup_time: string
    pickup_location: string
    expected_package_count: number
  }) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/fm/request/new/`
      const payload = {
        pickup_date,
        pickup_time,
        pickup_location, // must exactly match warehouse name in Delhivery
        expected_package_count,
      }

      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const res = await this.postWithTimeout(url, payload, { headers })
      const responseData = res.data
      const rejected =
        responseData?.success === false ||
        responseData?.status === false ||
        Boolean(responseData?.error) ||
        Boolean(responseData?.errors)

      if (rejected) {
        throw new Error(
          extractProviderErrorMessage(responseData) || 'Delhivery pickup request was rejected',
        )
      }

      return responseData
    } catch (err: any) {
      const providerError = err.response?.data
      const timeoutError = isTimeoutError(err)

      const providerMessage =
        (!timeoutError && extractProviderErrorMessage(providerError?.pickup_date)) ||
        extractProviderErrorMessage(providerError?.message) ||
        extractProviderErrorMessage(providerError?.error) ||
        (!timeoutError && extractProviderErrorMessage(providerError)) ||
        (typeof err.message === 'string' && err.message.trim().length > 0 && !timeoutError
          ? err.message.trim()
          : 'Pickup request is taking longer than expected. Please try again.')

      const existingPickupRequestId = getExistingPickupRequestId(providerMessage)
      if (existingPickupRequestId) {
        console.warn('ℹ️ Delhivery pickup request already exists; treating as accepted', {
          pickup_request_id: existingPickupRequestId,
          pickup_location,
          pickup_date,
          pickup_time,
          expected_package_count,
        })
        return {
          success: true,
          already_exists: true,
          pickup_request_id: existingPickupRequestId,
          message: providerMessage,
          provider_response: providerError || null,
        }
      }

      console.error('❌ Delhivery pickup request error:', providerError || err.message)

      const error = new Error(providerMessage)
      ;(error as any).statusCode = typeof err.response?.status === 'number'
        ? err.response.status
        : timeoutError
          ? 504
          : 500
      ;(error as any).details = providerError || null
      ;(error as any).isPickupRequestError = true
      ;(error as any).providerStatus = err.response?.status ?? null
      ;(error as any).providerStatusText = err.response?.statusText ?? null
      ;(error as any).code = err?.code ?? null
      throw error
    }
  }
  // 🔹 9. Fetch Shipping Label from Delhivery packing_slip API
  // format=json -> metadata (barcodes, sort code, etc.)
  // format=pdf  -> raw PDF bytes (used to ensure provider-side label generation activity)
  async updateShipment(
    waybill: string,
    updates: {
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
    },
  ) {
    await this.ensureCredentials()
    const res = await this.postWithTimeout(
      `${this.apiBase}/api/p/edit`,
      {
        waybill: String(waybill || '').trim(),
        ...updates,
      },
      { headers: this.headers },
    )
    return res.data
  }

  async updateEwaybill(
    waybill: string,
    data:
      | {
          dcn: string
          ewbn: string
        }
      | Array<{
          dcn: string
          ewbn: string
        }>,
  ) {
    await this.ensureCredentials()
    const entries = Array.isArray(data) ? data : [data]
    const res = await axios.put(
      `${this.apiBase}/api/rest/ewaybill/${encodeURIComponent(String(waybill || '').trim())}/`,
      { data: entries },
      {
        headers: this.headers,
        timeout: this.requestTimeoutMs,
      },
    )
    return res.data
  }

  async calculateShippingCost(params: {
    md: 'E' | 'S'
    cgm: number
    o_pin: string | number
    d_pin: string | number
    ss: string
    pt: string
    l?: number
    b?: number
    h?: number
    ipkg_type?: string
  }) {
    await this.ensureCredentials()
    const query = qs.stringify(params)
    const res = await this.getWithTimeout(
      `${this.apiBase}/api/kinko/v1/invoice/charges/.json?${query}`,
      { headers: this.headers },
      65000,
    )
    return res.data
  }

  async generateLabel(
    awb: string,
    options: { format?: 'json' | 'pdf'; pdfSize?: 'A4' | '4R' } = { format: 'json' },
  ) {
    await this.ensureCredentials()
    const format = options.format || 'json'
    const pdfSize =
      options.pdfSize && ['A4', '4R'].includes(options.pdfSize) ? options.pdfSize : undefined
    const url = `${this.apiBase}/api/p/packing_slip?wbns=${encodeURIComponent(awb)}${
      format === 'pdf' ? '&pdf=true' : '&pdf=false'
    }${pdfSize ? `&pdf_size=${encodeURIComponent(pdfSize)}` : ''}`
    const responseType = format === 'pdf' ? 'arraybuffer' : 'json'
    const res = await this.getWithTimeout(
      url,
      {
      headers: this.headers,
      responseType,
      },
      format === 'pdf' ? this.labelTimeoutMs : this.requestTimeoutMs,
    )

    return format === 'pdf' ? Buffer.from(res.data) : res.data
  }

  // COD Settlement APIs not publicly available
  // Use CSV download from Delhivery dashboard instead:
  // Dashboard → Finances → Remittance → Download Report
}
