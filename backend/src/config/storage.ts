import * as dotenv from 'dotenv'
import path from 'path'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../.env.${env}`) })

const trimEnvValue = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const firstDefined = (...values: Array<string | undefined>) => values.find(Boolean)

export const getR2Endpoint = () => {
  const endpoint = trimEnvValue(process.env.R2_ENDPOINT)

  if (!endpoint) {
    throw new Error(
      'Missing R2 storage endpoint. Set R2_ENDPOINT in the backend environment.',
    )
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
  )

  if (fallbackBucket) {
    return fallbackBucket
  }

  throw new Error(
    'Missing R2 bucket configuration. Set R2_BUCKET (recommended) or one of PROD_BUCKET, STAGING_BUCKET, or DEV_BUCKET in the backend environment.',
  )
}

export const validateStorageConfig = () => {
  const endpoint = getR2Endpoint()
  const { accessKeyId } = getR2Credentials()
  const bucket = getBucketName()

  return {
    endpoint,
    bucket,
    accessKeyIdPreview: `${accessKeyId.slice(0, 4)}...${accessKeyId.slice(-4)}`,
  }
}
