import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import Razorpay from 'razorpay'

// Load correct .env based on NODE_ENV
const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

type RazorpayMode = 'test' | 'live'

/**
 * Pick your mode from either:
 *  1. RAZORPAY_MODE - explicit override ("test" | "live")
 *  2. NODE_ENV === production - implicit live mode
 */
const MODE: RazorpayMode =
  (process.env.RAZORPAY_MODE as RazorpayMode) ??
  (process.env.NODE_ENV === 'production' ? 'live' : 'test')

const CREDENTIALS: Record<RazorpayMode, { key_id?: string; key_secret?: string }> = {
  test: {
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  },
  live: {
    key_id: process.env.RAZORPAY_KEY_ID_PROD,
    key_secret: process.env.RAZORPAY_KEY_SECRET_PROD,
  },
}

export const isRazorpayConfigured = Boolean(
  CREDENTIALS[MODE].key_id && CREDENTIALS[MODE].key_secret,
)

/** A single, shared Razorpay instance you can import anywhere in your app. */
export const razorpay = new Razorpay({
  key_id: CREDENTIALS[MODE].key_id ?? '',
  key_secret: CREDENTIALS[MODE].key_secret ?? '',
})

if (isRazorpayConfigured) {
  console.info(
    `[Razorpay] Initialised in ${MODE.toUpperCase()} mode with key ${CREDENTIALS[MODE].key_id}`,
  )
} else {
  console.warn(
    `[Razorpay] Disabled: missing env vars for ${MODE.toUpperCase()} mode. Wallet top-ups are unavailable until configured.`,
  )
}

export const razorpayApi = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  auth: {
    username: MODE === 'live' ? CREDENTIALS.live.key_id ?? '' : CREDENTIALS.test.key_id ?? '',
    password:
      MODE === 'live'
        ? CREDENTIALS.live.key_secret ?? ''
        : CREDENTIALS.test.key_secret ?? '',
  },
})

export function isValidSig(body: string, sig: string) {
  if (!isRazorpayConfigured) return false

  const secret = MODE === 'live' ? process.env.RAZORPAY_WEBHOOK_SECRET_PROD : process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return false

  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return expected === sig
}
