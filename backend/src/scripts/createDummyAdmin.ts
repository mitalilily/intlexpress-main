import * as dotenv from 'dotenv'
import path from 'path'
import bcryptjs from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../models/client'
import { userProfiles } from '../models/schema/userProfile'
import { users } from '../models/schema/users'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

async function createDummyAdmin() {
  try {
    console.log('Creating dummy admin user...')

    const email = 'admin@intlexpress.local'
    const password = 'Admin@12345'
    const hashedPassword = await bcryptjs.hash(password, 10)

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existingUser) {
      console.log('Admin user already exists. Updating...')
      await db
        .update(users)
        .set({
          passwordHash: hashedPassword,
          emailVerified: true,
          phoneVerified: true,
          accountVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
      console.log('Admin password updated')
    } else {
      const newUser = await db
        .insert(users)
        .values({
          email,
          passwordHash: hashedPassword,
          emailVerified: true,
          phoneVerified: true,
          accountVerified: true,
          role: 'admin',
        })
        .returning()

      console.log('Admin user created:', newUser[0].id)

      await db
        .insert(userProfiles)
        .values({
          userId: newUser[0].id,
          companyInfo: {
            businessName: 'IntleExpress Admin',
            contactPerson: 'Admin User',
            POCEmailVerified: true,
            POCPhoneVerified: true,
            companyAddress: '123 Test Street',
            pincode: '110001',
            state: 'Delhi',
            city: 'New Delhi',
            contactNumber: '+919876543210',
            contactEmail: 'admin@intlexpress.local',
            companyContactNumber: '+919876543210',
            brandName: 'IntleExpress',
            companyEmail: 'admin@intlexpress.local',
            website: 'https://intlexpress.local',
          },
          businessType: ['b2c'],
          approved: true,
          onboardingComplete: true,
          profileComplete: true,
          approvedAt: new Date(),
        })
        .returning()

      console.log('User profile created with approved=true, onboardingComplete=true')
    }

    console.log('\nDummy admin setup complete')
    console.log('Email: admin@intlexpress.local')
    console.log('Password: Admin@12345')
    console.log('\nYou can now login to the admin panel with these credentials.')

    process.exit(0)
  } catch (error) {
    console.error('Error creating dummy admin:', error)
    process.exit(1)
  }
}

createDummyAdmin()
