import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import * as dotenv from 'dotenv'
import path from 'path'
import { getR2Credentials, getR2Endpoint } from './storage'

// Determine environment
const env = process.env.NODE_ENV || 'development'

// Load the correct .env file
dotenv.config({ path: path.resolve(__dirname, `../.env.${env}`) })

const { accessKeyId, secretAccessKey } = getR2Credentials()

export const r2 = new S3Client({
  region: 'auto',
  endpoint: getR2Endpoint(),
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
})

export const downloadR2ObjectAsBuffer = async (bucket: string, key: string): Promise<Buffer> => {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
  const res = await r2.send(cmd)
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as any) chunks.push(chunk)
  return Buffer.concat(chunks)
}
