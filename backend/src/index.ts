import * as dotenv from 'dotenv'
import path from 'path'
import { server } from './app'
import './crons'
import { validateStorageConfig } from './config/storage'
import { testDatabaseConnection } from './models/client'
import { ensureAuthBillingSchemaCompatibility } from './models/services/authBillingSchemaCompatibility.service'
import { ensureDefaultAdminBootstrap } from './models/services/defaultAdminBootstrap.service'

const env = process.env.NODE_ENV || 'development'
console.log('node env', env)

dotenv.config({ path: path.resolve(__dirname, `../.env.${env}`) })

const PORT = process.env.PORT || 4000

async function startServer() {
  const storageConfig = validateStorageConfig()
  console.log('R2 storage configured', {
    bucket: storageConfig.bucket,
    endpoint: storageConfig.endpoint,
    accessKeyId: storageConfig.accessKeyIdPreview,
  })

  console.log('Testing database connection...')
  const dbConnected = await testDatabaseConnection()

  if (!dbConnected) {
    console.error('Failed to connect to database. Server will not start.')
    process.exit(1)
  }

  console.log('Ensuring auth and billing schema compatibility...')
  await ensureAuthBillingSchemaCompatibility()
  console.log('Auth and billing schema compatibility check completed')

  console.log('Ensuring default admin bootstrap...')
  await ensureDefaultAdminBootstrap()
  console.log('Default admin bootstrap check completed')

  server.timeout = 210000

  server.listen(PORT, () => {
    const url =
      env === 'production'
        ? process.env.API_PUBLIC_URL || 'https://api.intlexpress.in'
        : `http://localhost:${PORT}`
    console.log(`Server running on port ${PORT} in ${env} mode at ${url}`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
