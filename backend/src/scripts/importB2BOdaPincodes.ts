import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { pool } from '../models/client'
import { importPincodesFromCsv } from '../models/services/b2bAdmin.service'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const csvPath = process.argv[2]

if (!csvPath) {
  console.error('Usage: tsx src/scripts/importB2BOdaPincodes.ts <csv-path>')
  process.exit(1)
}

async function main() {
  const absolutePath = path.resolve(csvPath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`CSV file not found: ${absolutePath}`)
  }

  const buffer = fs.readFileSync(absolutePath)
  const result = await importPincodesFromCsv(buffer, {})

  const sampleOda = (result as any).sampleOdaPincode || null
  console.log(
    JSON.stringify(
      {
        csvPath: absolutePath,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped.length,
        total: result.total,
        sampleOda,
        firstSkipped: result.skipped.slice(0, 5),
      },
      null,
      2,
    ),
  )

  if (result.skipped.length) {
    process.exitCode = 2
  }
}

main()
  .catch((error) => {
    console.error(error?.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
