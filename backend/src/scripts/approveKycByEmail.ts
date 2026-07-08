import * as dotenv from 'dotenv'
import path from 'path'
import { eq } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { kyc } from '../models/schema/kyc'
import { userProfiles } from '../models/schema/userProfile'
import { users } from '../models/schema/users'
import { ensureUserBootstrapRecords, findUserByEmail, updateUserApprovalStatus } from '../models/services/userService'
import { updateKycStatus } from '../models/services/kyc.service'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

async function approveKycByEmail() {
  const emailArg = process.argv[2]
  const email = String(emailArg || '').trim().toLowerCase()

  if (!email) {
    throw new Error('Usage: tsx src/scripts/approveKycByEmail.ts <email>')
  }

  console.log(`Looking up user by email: ${email}`)

  const user = await findUserByEmail(email)
  if (!user) {
    throw new Error(`No user found for ${email}`)
  }

  await ensureUserBootstrapRecords(user.id)

  const [existingKyc] = await db.select().from(kyc).where(eq(kyc.userId, user.id)).limit(1)
  const now = new Date()

  if (!existingKyc) {
    await db.transaction(async (tx) => {
      await tx.insert(kyc).values({
        userId: user.id,
        status: 'verified',
        panCardStatus: 'verified',
        aadhaarStatus: 'verified',
        cancelledChequeStatus: 'verified',
        companyAddressProofStatus: 'verified',
        boardResolutionStatus: 'verified',
        partnershipDeedStatus: 'verified',
        cinStatus: 'verified',
        llpAgreementStatus: 'verified',
        businessPanStatus: 'verified',
        gstCertificateStatus: 'verified',
        createdAt: now,
        updatedAt: now,
      })

      await tx
        .update(userProfiles)
        .set({
          domesticKyc: {
            status: 'verified',
            updatedAt: now,
          },
          updatedAt: now,
        })
        .where(eq(userProfiles.userId, user.id))
    })
  } else {
    await updateKycStatus(user.id, 'verified')
  }

  await updateUserApprovalStatus(user.id, true)
  await db
    .update(users)
    .set({
      accountVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  const [updatedKyc] = await db.select().from(kyc).where(eq(kyc.userId, user.id)).limit(1)

  console.log('KYC approved successfully', {
    email,
    userId: user.id,
    kycStatus: updatedKyc?.status ?? null,
    accountVerified: true,
  })
}

approveKycByEmail()
  .catch((error) => {
    console.error('Failed to approve KYC by email:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
