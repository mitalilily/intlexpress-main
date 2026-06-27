import * as dotenv from 'dotenv'
import path from 'path'
import { ensureDefaultAdminBootstrap } from '../models/services/defaultAdminBootstrap.service'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

async function createDummyAdmin() {
  try {
    console.log('Creating dummy admin user...')

    const result = await ensureDefaultAdminBootstrap({ force: true })
    if (!result) {
      throw new Error('Default admin bootstrap returned no result')
    }

    console.log('\nDummy admin setup complete')
    console.log(`Email: ${result.email}`)
    console.log(`Password: ${result.password}`)
    console.log('\nYou can now login to the admin panel with these credentials.')

    process.exit(0)
  } catch (error) {
    console.error('Error creating dummy admin:', error)
    process.exit(1)
  }
}

createDummyAdmin()
