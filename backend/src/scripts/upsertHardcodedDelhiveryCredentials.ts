import * as dotenv from 'dotenv'
import { eq } from 'drizzle-orm'
import path from 'path'
import { db, pool } from '../models/client'
import { courier_credentials } from '../models/schema/courierCredentials'
import {
  DEFAULT_DELHIVERY_API_BASE,
  HARDCODED_DELHIVERY_API_KEY,
} from '../models/services/delhiveryCredentials.service'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

const DEFAULT_DELHIVERY_ACCOUNT = {
  accountCode: 'account_1',
  accountLabel: 'Delhivery B2C Account',
  apiBase: DEFAULT_DELHIVERY_API_BASE,
  clientName: '',
  apiKey: HARDCODED_DELHIVERY_API_KEY,
  username: '',
  password: '',
  b2bAuthToken: '',
  b2bAuthTokenExpiresAt: '',
  isActive: true,
  isDefault: true,
  pickupLocationIds: [],
  pickupLocationNames: [],
}

const parseRecord = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, any>
}

async function upsertHardcodedDelhiveryCredentials() {
  const [existing] = await db
    .select({
      id: courier_credentials.id,
      apiBase: courier_credentials.apiBase,
      clientName: courier_credentials.clientName,
      username: courier_credentials.username,
      password: courier_credentials.password,
      metadata: courier_credentials.metadata,
    })
    .from(courier_credentials)
    .where(eq(courier_credentials.provider, 'delhivery'))
    .limit(1)

  const existingMetadata = parseRecord(existing?.metadata)
  const existingAccounts = Array.isArray(existingMetadata.delhiveryAccounts)
    ? existingMetadata.delhiveryAccounts
    : []

  const primaryAccount = existingAccounts[0] && typeof existingAccounts[0] === 'object'
    ? { ...DEFAULT_DELHIVERY_ACCOUNT, ...(existingAccounts[0] as Record<string, any>) }
    : DEFAULT_DELHIVERY_ACCOUNT

  const nextPrimaryAccount = {
    ...primaryAccount,
    accountCode: 'account_1',
    accountLabel: String(primaryAccount.accountLabel || 'Delhivery B2C Account').trim(),
    apiBase: String(primaryAccount.apiBase || existing?.apiBase || DEFAULT_DELHIVERY_API_BASE).trim(),
    clientName: String(primaryAccount.clientName || existing?.clientName || '').trim(),
    username: String(primaryAccount.username || existing?.username || '').trim(),
    password: String(primaryAccount.password || existing?.password || '').trim(),
    apiKey: HARDCODED_DELHIVERY_API_KEY,
    isActive: true,
    isDefault: true,
    pickupLocationIds: Array.isArray(primaryAccount.pickupLocationIds)
      ? primaryAccount.pickupLocationIds
      : [],
    pickupLocationNames: Array.isArray(primaryAccount.pickupLocationNames)
      ? primaryAccount.pickupLocationNames
      : [],
  }

  const nextMetadata = {
    ...existingMetadata,
    delhiveryAccountsVersion: 2,
    delhiveryAccounts: [
      nextPrimaryAccount,
      ...existingAccounts.slice(1),
    ],
  }

  const values = {
    provider: 'delhivery' as const,
    apiBase: nextPrimaryAccount.apiBase || DEFAULT_DELHIVERY_API_BASE,
    clientName: nextPrimaryAccount.clientName || '',
    apiKey: HARDCODED_DELHIVERY_API_KEY,
    username: nextPrimaryAccount.username || '',
    password: nextPrimaryAccount.password || '',
    metadata: nextMetadata,
    updatedAt: new Date(),
  }

  await db
    .insert(courier_credentials)
    .values(values)
    .onConflictDoUpdate({
      target: courier_credentials.provider,
      set: values,
    })

  console.log(
    JSON.stringify(
      {
        provider: 'delhivery',
        apiBase: values.apiBase,
        clientName: values.clientName,
        apiKeyPreview: `${HARDCODED_DELHIVERY_API_KEY.slice(0, 6)}...${HARDCODED_DELHIVERY_API_KEY.slice(-6)}`,
        storedAccounts: nextMetadata.delhiveryAccounts.length,
      },
      null,
      2,
    ),
  )
}

upsertHardcodedDelhiveryCredentials()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (error: any) => {
    console.error(
      'Failed to upsert hardcoded Delhivery credentials:',
      error?.message || error,
    )
    console.error(error)
    await pool.end()
    process.exit(1)
  })
