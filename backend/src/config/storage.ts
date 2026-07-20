import * as dotenv from 'dotenv'
import path from 'path'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../.env.${env}`) })

const trimEnvValue = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const firstDefined = (...values: Array<string | undefined>) => values.find(Boolean)

const parseUrl = (value?: string) => {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const getBucketNameFromEndpointPath = () => {
  const endpoint = trimEnvValue(process.env.R2_ENDPOINT)
  const parsed = parseUrl(endpoint)
  if (!parsed) return undefined

  const pathParts = parsed.pathname.split('/').filter(Boolean)
  return pathParts.length === 1 ? pathParts[0] : undefined
}

export const getR2Endpoint = () => {
  const endpoint = trimEnvValue(process.env.R2_ENDPOINT)

  if (!endpoint) {
    throw new Error(
      'Missing R2 storage endpoint. Set R2_ENDPOINT in the backend environment.',
    )
  }

  const parsed = parseUrl(endpoint)
  if (parsed) {
    parsed.pathname = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/+$/, '')
  }

  return endpoint.replace(/\/+$/, '')
}

export const getR2Credentials = () => {
  const accessKeyId = trimEnvValue(process.env.R2_ACCESS_KEY_ID)
  const secretAccessKey = trimEnvValue(process.env.R2_SECRET_ACCESS_KEY)

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 storage credentials. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in the backend environment.',
    )
  }

  return { accessKeyId, secretAccessKey }
}

export const getBucketName = () => {
  const sharedBucket = firstDefined(
    trimEnvValue(process.env.R2_BUCKET),
    trimEnvValue(process.env.BUCKET_NAME),
  )

  if (sharedBucket) {
    return sharedBucket
  }

  const normalizedEnv = String(process.env.NODE_ENV || 'development').trim().toLowerCase()
  const envBucket =
    normalizedEnv === 'production'
      ? trimEnvValue(process.env.PROD_BUCKET)
      : normalizedEnv === 'staging'
        ? trimEnvValue(process.env.STAGING_BUCKET)
        : trimEnvValue(process.env.DEV_BUCKET)

  if (envBucket) {
    return envBucket
  }

  const fallbackBucket = firstDefined(
    trimEnvValue(process.env.PROD_BUCKET),
    trimEnvValue(process.env.STAGING_BUCKET),
    trimEnvValue(process.env.DEV_BUCKET),
    getBucketNameFromEndpointPath(),
  )

  if (fallbackBucket) {
    return fallbackBucket
  }

  throw new Error(
    'Missing R2 bucket configuration. Set R2_BUCKET (recommended) or one of PROD_BUCKET, STAGING_BUCKET, or DEV_BUCKET in the backend environment.',
  )
}

export const getStorageKeyPrefix = () => {
  const rawPrefix = firstDefined(
    trimEnvValue(process.env.R2_KEY_PREFIX),
    trimEnvValue(process.env.R2_PREFIX),
    trimEnvValue(process.env.STORAGE_KEY_PREFIX),
  )

  if (!rawPrefix) return ''

  return rawPrefix
    .split('/')
    .map((segment) =>
      segment
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, ''),
    )
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/')
}

export const applyStorageKeyPrefix = (key: string) => {
  const normalizedKey = String(key || '')
    .trim()
    .replace(/^\/+/, '')
  const prefix = getStorageKeyPrefix()

  if (!prefix || !normalizedKey || normalizedKey === prefix || normalizedKey.startsWith(`${prefix}/`)) {
    return normalizedKey
  }

  return `${prefix}/${normalizedKey}`
}

export const buildStorageObjectKey = ({
  folderKey,
  userId,
  filename,
}: {
  folderKey: string
  userId: string
  filename: string
}) => {
  const rawKey = [folderKey, userId, filename]
    .map((part) => String(part || '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')

  return applyStorageKeyPrefix(rawKey)
}

export const buildR2PublicUrl = (bucket: string, key: string) => {
  const endpoint = getR2Endpoint()
  const normalizedBucket = String(bucket || '').trim().replace(/^\/+|\/+$/g, '')
  const normalizedKey = String(key || '').trim().replace(/^\/+/, '')
  return `${endpoint}/${normalizedBucket}/${normalizedKey}`
}

export const validateStorageConfig = () => {
  const endpoint = getR2Endpoint()
  const { accessKeyId } = getR2Credentials()
  const bucket = getBucketName()
  const keyPrefix = getStorageKeyPrefix()

  return {
    endpoint,
    bucket,
    keyPrefix,
    accessKeyIdPreview: `${accessKeyId.slice(0, 4)}...${accessKeyId.slice(-4)}`,
  }
}
