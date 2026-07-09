import * as dotenv from 'dotenv'
import 'dotenv/config'
import { and, eq, inArray, sql } from 'drizzle-orm'
import * as path from 'path'
import { db, pool } from '../models/client'
import { seedDefaultAdditionalCharges } from '../models/services/b2bPricingConfig.service'
import { remapZonePincodes } from '../models/services/zone.service'
import { courier_credentials } from '../models/schema/courierCredentials'
import { couriers } from '../models/schema/couriers'
import {
  b2bAdditionalCharges,
  b2bPincodes,
  b2bZoneStates,
  b2bZoneToZoneRates,
  zones,
} from '../models/schema/zones'

const env = process.env.NODE_ENV || 'development'
const envFilePath = path.resolve(__dirname, `../../.env.${env}`)
dotenv.config({ path: envFilePath })

const delhiveryCourierSeeds = [
  { id: 99, name: 'Delhivery Air' },
  { id: 100, name: 'Delhivery Surface' },
]

const defaultB2BZones = [
  {
    code: 'N1',
    name: 'Zone N1',
    description: 'Northern cluster 1 for Delhivery B2B.',
    region: 'North',
    states: [
      'Chandigarh',
      'Delhi',
      'Haryana',
      'Himachal Pradesh',
      'Jammu & Kashmir',
      'Jammu and Kashmir',
      'Ladakh',
      'Punjab',
    ],
  },
  {
    code: 'N2',
    name: 'Zone N2',
    description: 'Northern cluster 2 for Delhivery B2B.',
    region: 'North',
    states: ['Uttar Pradesh', 'Uttarakhand'],
  },
  {
    code: 'E',
    name: 'Zone E',
    description: 'Eastern cluster for Delhivery B2B.',
    region: 'East',
    states: ['Bihar', 'Jharkhand', 'Orissa', 'Odisha', 'West Bengal'],
  },
  {
    code: 'NE',
    name: 'Zone NE',
    description: 'North-east cluster for Delhivery B2B.',
    region: 'North East',
    states: [
      'Arunachal Pradesh',
      'Assam',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Sikkim',
      'Tripura',
    ],
  },
  {
    code: 'W1',
    name: 'Zone W1',
    description: 'Western cluster 1 for Delhivery B2B.',
    region: 'West',
    states: [
      'Dadra and Nagar Haveli',
      'Daman & Diu',
      'Daman and Diu',
      'Dadra and Nagar Haveli and Daman and Diu',
      'Gujarat',
      'Rajasthan',
    ],
  },
  {
    code: 'W2',
    name: 'Zone W2',
    description: 'Western cluster 2 for Delhivery B2B.',
    region: 'West',
    states: ['Goa', 'Maharashtra'],
  },
  {
    code: 'S1',
    name: 'Zone S1',
    description: 'Southern cluster 1 for Delhivery B2B.',
    region: 'South',
    states: ['Andhra Pradesh', 'Karnataka', 'Telangana'],
  },
  {
    code: 'S2',
    name: 'Zone S2',
    description: 'Southern cluster 2 for Delhivery B2B.',
    region: 'South',
    states: ['Kerala', 'Pondicherry', 'Puducherry', 'Tamil Nadu'],
  },
  {
    code: 'Central',
    name: 'Zone Central',
    description: 'Central cluster for Delhivery B2B.',
    region: 'Central',
    states: ['Chhattisgarh', 'Madhya Pradesh'],
  },
] as const

const isTransientDbError = (error: any) => {
  const code = String(error?.code || error?.cause?.code || '').trim().toUpperCase()
  const message = String(error?.message || error?.cause?.message || '')
    .trim()
    .toLowerCase()

  return (
    ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(code) ||
    message.includes('econnreset') ||
    message.includes('timeout')
  )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const runWithRetry = async <T>(label: string, work: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: any = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work()
    } catch (error: any) {
      lastError = error
      if (attempt >= attempts || !isTransientDbError(error)) {
        throw error
      }

      const backoffMs = attempt * 1500
      console.warn(
        `[prepareDelhiveryB2B] ${label} failed with a transient database error (attempt ${attempt}/${attempts}). Retrying in ${backoffMs}ms...`,
      )
      await wait(backoffMs)
    }
  }

  throw lastError
}

const ensureDelhiveryCouriers = async () => {
  for (const courier of delhiveryCourierSeeds) {
    await runWithRetry(`insert courier ${courier.id}`, () =>
      db
        .insert(couriers)
        .values({
          id: courier.id,
          name: courier.name,
          serviceProvider: 'delhivery',
          businessType: ['b2c', 'b2b'],
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [couriers.id, couriers.serviceProvider],
        }),
    )
  }

  const delhiveryCouriers = await runWithRetry('load Delhivery couriers', () =>
    db
      .select({
        id: couriers.id,
        name: couriers.name,
        businessType: couriers.businessType,
        isEnabled: couriers.isEnabled,
      })
      .from(couriers)
      .where(eq(couriers.serviceProvider, 'delhivery')),
  )

  for (const courier of delhiveryCouriers) {
    const nextBusinessType = Array.from(
      new Set([...(Array.isArray(courier.businessType) ? courier.businessType : []), 'b2b', 'b2c']),
    ) as ('b2c' | 'b2b')[]

    await runWithRetry(`update courier ${courier.id}`, () =>
      db
        .update(couriers)
        .set({
          businessType: nextBusinessType,
          isEnabled: true,
          updatedAt: new Date(),
        })
        .where(and(eq(couriers.id, courier.id), eq(couriers.serviceProvider, 'delhivery'))),
    )
  }

  return delhiveryCouriers.length
}

const ensureB2BZones = async () => {
  for (const zone of defaultB2BZones) {
    await runWithRetry(`upsert zone ${zone.code}`, () =>
      db
        .insert(zones)
        .values({
          code: zone.code,
          name: zone.name,
          description: zone.description,
          region: zone.region,
          business_type: 'B2B',
          states: [...zone.states],
          metadata: {
            source: 'prepareDelhiveryB2B/defaultStateMap',
            zoneCode: zone.code,
          },
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflictDoNothing({
          target: [zones.code, zones.business_type],
        }),
    )
  }

  const existingZones = await runWithRetry('load B2B zones', () =>
    db
      .select({ id: zones.id, code: zones.code })
      .from(zones)
      .where(
        and(
          eq(zones.business_type, 'B2B'),
          inArray(
            zones.code,
            defaultB2BZones.map((zone) => zone.code),
          ),
        ),
      ),
  )

  const zoneIdByCode = new Map(existingZones.map((zone) => [zone.code, zone.id]))

  for (const zone of defaultB2BZones) {
    const zoneId = zoneIdByCode.get(zone.code)
    if (!zoneId) continue

    await runWithRetry(`update zone ${zone.code}`, () =>
      db
        .update(zones)
        .set({
          name: zone.name,
          description: zone.description,
          region: zone.region,
          states: [...zone.states],
          metadata: {
            source: 'prepareDelhiveryB2B/defaultStateMap',
            zoneCode: zone.code,
            lastSyncedAt: new Date().toISOString(),
          },
          updated_at: new Date(),
        })
        .where(eq(zones.id, zoneId)),
    )
  }

  return zoneIdByCode
}

const ensureZoneStatesAndPincodes = async (zoneIdByCode: Map<string, string>) => {
  const zoneIds = Array.from(zoneIdByCode.values())
  if (!zoneIds.length) return

  await runWithRetry('refresh Delhivery B2B zone states', () =>
    db.transaction(async (tx) => {
      await tx.delete(b2bZoneStates).where(inArray(b2bZoneStates.zone_id, zoneIds))

      const zoneStateRows = defaultB2BZones.flatMap((zone) =>
        zone.states.map((stateName) => ({
          zone_id: zoneIdByCode.get(zone.code)!,
          state_name: stateName,
          courier_id: null,
          service_provider: 'delhivery',
          created_at: new Date(),
          updated_at: new Date(),
        })),
      )

      if (zoneStateRows.length) {
        await tx.insert(b2bZoneStates).values(zoneStateRows)
      }
    }),
  )

  for (const zone of defaultB2BZones) {
    const zoneId = zoneIdByCode.get(zone.code)
    if (!zoneId) continue
    await runWithRetry(`remap B2B pincodes for ${zone.code}`, () => remapZonePincodes(zoneId))
  }
}

const getAuditSummary = async () => {
  const [credentialRows, chargeRows, zoneStateRows, zoneRateRows, b2bZoneRows, b2bPincodeRows, courierRows] =
    await runWithRetry('load audit summary', () =>
      Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(courier_credentials)
          .where(eq(courier_credentials.provider, 'delhivery')),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(b2bAdditionalCharges)
          .where(eq(b2bAdditionalCharges.service_provider, 'delhivery')),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(b2bZoneStates)
          .where(eq(b2bZoneStates.service_provider, 'delhivery')),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(b2bZoneToZoneRates)
          .where(eq(b2bZoneToZoneRates.service_provider, 'delhivery')),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(zones)
          .where(eq(zones.business_type, 'B2B')),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(b2bPincodes),
        db
          .select({
            id: couriers.id,
            name: couriers.name,
            businessType: couriers.businessType,
            isEnabled: couriers.isEnabled,
          })
          .from(couriers)
          .where(
            and(
              eq(couriers.serviceProvider, 'delhivery'),
              inArray(
                couriers.id,
                delhiveryCourierSeeds.map((courier) => courier.id),
              ),
            ),
          ),
      ]),
    )

  return {
    delhiveryCredentialRows: credentialRows[0]?.count ?? 0,
    delhiveryB2BChargeRows: chargeRows[0]?.count ?? 0,
    delhiveryB2BZoneStateRows: zoneStateRows[0]?.count ?? 0,
    delhiveryB2BZoneRateRows: zoneRateRows[0]?.count ?? 0,
    totalB2BZones: b2bZoneRows[0]?.count ?? 0,
    totalB2BPincodes: b2bPincodeRows[0]?.count ?? 0,
    delhiveryCouriers: courierRows,
  }
}

async function prepareDelhiveryB2B() {
  console.log('Preparing Delhivery B2B repo/database bootstrap...')

  const ensuredCourierCount = await ensureDelhiveryCouriers()
  const zoneIdByCode = await ensureB2BZones()
  await ensureZoneStatesAndPincodes(zoneIdByCode)
  await runWithRetry('seed default Delhivery B2B charges', () =>
    seedDefaultAdditionalCharges({
      courierScope: { serviceProvider: 'delhivery' },
    }),
  )

  const summary = await getAuditSummary()

  console.log(
    JSON.stringify(
      {
        ensuredCourierCount,
        summary,
        nextSteps: [
          'Save Delhivery API credentials in Admin > Couriers > Credentials if credentials row count is 0.',
          'Review any uncovered special territories such as Andaman and Nicobar and map them manually if your lane mix requires them.',
          'Upload or seed Delhivery B2B zone-to-zone commercial rates into shiplifi_b2b_zone_to_zone_rates if counts are still 0.',
          'Review provider-level additional charges in Admin > B2B pricing before live bookings.',
        ],
      },
      null,
      2,
    ),
  )
}

prepareDelhiveryB2B()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (error: any) => {
    console.error('prepareDelhiveryB2B failed:', error?.message || error)
    console.error(error)
    await pool.end()
    process.exit(1)
  })
