import 'dotenv/config'
import fs from 'fs'

import { db } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { plans } from '../models/schema/plans'
import { importZoneRatesFromCsv } from '../models/services/b2bAdmin.service'
import { eq } from 'drizzle-orm'

const getArg = (name: string, fallback = '') => {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

const main = async () => {
  const csvPath = getArg('csv')
  const courierId = Number(getArg('courier-id'))
  const serviceProvider = getArg('service-provider', 'delhivery')
  const planName = getArg('plan-name', 'Basic')
  const planIdArg = getArg('plan-id')

  if (!csvPath) throw new Error('Pass --csv=/path/to/rate-matrix.csv')
  if (!Number.isFinite(courierId) || courierId <= 0) {
    throw new Error('Pass --courier-id=<courier id>')
  }

  const [courier] = await db
    .select({ id: couriers.id, name: couriers.name })
    .from(couriers)
    .where(eq(couriers.id, courierId))
    .limit(1)
  if (!courier) throw new Error(`Courier not found for id ${courierId}`)

  let planId = planIdArg || ''
  if (!planId) {
    const [plan] = await db
      .select({ id: plans.id, name: plans.name })
      .from(plans)
      .where(eq(plans.name, planName))
      .limit(1)
    if (!plan) throw new Error(`Plan not found: ${planName}`)
    planId = plan.id
  }

  const result = await importZoneRatesFromCsv(fs.readFileSync(csvPath), {
    courierScope: { courierId, serviceProvider },
    planId,
  })

  console.log(
    JSON.stringify(
      {
        courier,
        serviceProvider,
        planId,
        csvPath,
        ...result,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
