import bcryptjs from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../client'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { findUserByEmail } from './userService'

const DEFAULT_ADMIN_EMAIL = 'admin@intlexpress.com'
const DEFAULT_ADMIN_PASSWORD = 'Admin@12345!'
const DEFAULT_ADMIN_PHONE = '+916283315911'

export const normalizeAdminEmail = (email: string) => String(email || '').trim().toLowerCase()

export const getAdminEmailCandidates = (email: string) => {
  const normalized = normalizeAdminEmail(email)
  const candidates = [normalized]
  const isKnownAdminAlias =
    normalized.startsWith('admin@intlexpress.') || normalized.startsWith('admin@shiplifi.')

  if (isKnownAdminAlias) {
    candidates.push(normalized.replace('admin@intlexpress.', 'admin@shiplifi.'))
    candidates.push(normalized.replace('admin@shiplifi.', 'admin@intlexpress.'))
    candidates.push('admin@intlexpress.com', 'admin@intlexpress.local')
    candidates.push('admin@shiplifi.com', 'admin@shiplifi.local')
  }

  return [...new Set(candidates.filter(Boolean))]
}

const shouldBootstrapDefaultAdmin = (force: boolean) => {
  if (force) return true

  const flag = String(process.env.BOOTSTRAP_DEFAULT_ADMIN || '')
    .trim()
    .toLowerCase()

  if (flag) {
    return ['1', 'true', 'yes', 'on'].includes(flag)
  }

  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production'
}

type EnsureDefaultAdminOptions = {
  force?: boolean
  email?: string
  password?: string
}

export const ensureDefaultAdminBootstrap = async (
  options: EnsureDefaultAdminOptions = {},
) => {
  const force = options.force === true
  if (!shouldBootstrapDefaultAdmin(force)) return null

  const email = normalizeAdminEmail(options.email || process.env.DEFAULT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
  const password = String(options.password || process.env.DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD)
  const phone = String(process.env.DEFAULT_ADMIN_PHONE || DEFAULT_ADMIN_PHONE)

  let existingUser: typeof users.$inferSelect | null = null
  for (const candidate of getAdminEmailCandidates(email)) {
    existingUser = await findUserByEmail(candidate)
    if (existingUser) break
  }

  const passwordHash = await bcryptjs.hash(password, 10)

  if (existingUser) {
    const [updatedUser] = await db
      .update(users)
      .set({
        email,
        phone: existingUser.phone || phone,
        passwordHash,
        emailVerified: true,
        phoneVerified: true,
        accountVerified: true,
        role: 'admin',
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .returning()

    await db
      .insert(userProfiles)
      .values({
        userId: updatedUser.id,
        companyInfo: {
          businessName: 'IntleExpress Admin',
          contactPerson: 'Admin User',
          POCEmailVerified: true,
          POCPhoneVerified: true,
          companyAddress: '123 Test Street',
          pincode: '110001',
          state: 'Delhi',
          city: 'New Delhi',
          contactNumber: phone,
          contactEmail: email,
          companyContactNumber: phone,
          brandName: 'IntleExpress',
          companyEmail: email,
          website: 'https://intlexpress.com',
        },
        businessType: ['b2c'],
        approved: true,
        onboardingComplete: true,
        profileComplete: true,
        approvedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          approved: true,
          onboardingComplete: true,
          profileComplete: true,
          approvedAt: new Date(),
          updatedAt: new Date(),
        },
      })

    console.log(`Default admin ensured for ${email}`)
    return { email, password, userId: updatedUser.id, mode: 'updated' as const }
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      phone,
      passwordHash,
      emailVerified: true,
      phoneVerified: true,
      accountVerified: true,
      role: 'admin',
    })
    .returning()

  await db.insert(userProfiles).values({
    userId: newUser.id,
    companyInfo: {
      businessName: 'IntleExpress Admin',
      contactPerson: 'Admin User',
      POCEmailVerified: true,
      POCPhoneVerified: true,
      companyAddress: '123 Test Street',
      pincode: '110001',
      state: 'Delhi',
      city: 'New Delhi',
      contactNumber: phone,
      contactEmail: email,
      companyContactNumber: phone,
      brandName: 'IntleExpress',
      companyEmail: email,
      website: 'https://intlexpress.com',
    },
    businessType: ['b2c'],
    approved: true,
    onboardingComplete: true,
    profileComplete: true,
    approvedAt: new Date(),
  })

  console.log(`Default admin created for ${email}`)
  return { email, password, userId: newUser.id, mode: 'created' as const }
}
