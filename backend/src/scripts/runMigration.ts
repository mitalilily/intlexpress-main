import 'dotenv/config'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { pool } from '../models/client'

async function runMigration() {
  const client = await pool.connect()
  try {
    const backendRoot = path.join(__dirname, '../..')
    const migrationFiles = readdirSync(backendRoot)
      .filter((file) => /^migration_.*\.sql$/i.test(file))
      .sort((a, b) => a.localeCompare(b))
      .map((file) => path.join(backendRoot, file))

    for (const migrationFile of migrationFiles) {
      try {
        console.log('📄 Reading migration file:', migrationFile)
        const sql = readFileSync(migrationFile, 'utf-8')

        const cleanSql = sql.trim()

        if (!cleanSql) {
          console.log('⚠️ No SQL found in migration file, skipping')
          continue
        }

        console.log('🔄 Executing migration...')
        console.log('SQL:', cleanSql)

        await client.query(cleanSql)
        console.log('✅ Migration executed successfully!')
      } catch (error: any) {
        if (
          error.message?.includes('already jsonb') ||
          error.message?.includes('already exists') ||
          error.message?.includes('duplicate_object')
        ) {
          console.log('ℹ️ Column already exists or is correct type, no action needed')
        } else if (
          error?.code === '42703' ||
          error?.code === '42P01' ||
          error.message?.includes('does not exist')
        ) {
          console.log('ℹ️ Legacy source column/table missing on this database, skipping this migration step')
        } else {
          console.error('❌ Migration failed:', error.message)
          throw error
        }
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Migration process completed')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  })
