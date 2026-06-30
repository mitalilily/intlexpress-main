import * as dotenv from 'dotenv'
import fs from 'fs'
import Papa from 'papaparse'
import path from 'path'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { plans } from '../models/schema/plans'
import { b2bPincodes, b2bZoneStates, b2bZoneToZoneRates, zones } from '../models/schema/zones'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

const PLAN_NAME = 'Basic'
const DELHIVERY_SURFACE_COURIER_ID = 100
const DELHIVERY_SERVICE_PROVIDER = 'delhivery'
const CSV_PATH =
  process.argv[2] ||
  path.resolve(__dirname, './data/basic-b2b-delhivery-surface-rate-matrix.csv')

const REQUIRED_ZONE_CODES = ['N1', 'N2', 'E', 'NE', 'W1', 'W2', 'S1', 'S2', 'Central'] as const

type ZoneCode = (typeof REQUIRED_ZONE_CODES)[number]

type RateCsvRow = {
  origin_zone_code: string
  destination_zone_code: string
  rate_per_kg: string
}

const parseCsv = (csvPath: string) => {
  const csv = fs.readFileSync(csvPath, 'utf8')
  const parsed = Papa.parse<RateCsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length) {
    throw new Error(`CSV parse failed: ${parsed.errors[0].message}`)
  }

  const rows = parsed.data.map((row) => ({
    originCode: String(row.origin_zone_code || '').trim(),
    destinationCode: String(row.destination_zone_code || '').trim(),
    ratePerKg: Number(row.rate_per_kg),
  }))

  if (!rows.length) {
    throw new Error('CSV does not contain any rows')
  }

  return rows
}

const assertExpectedMatrix = (
  rows: Array<{ originCode: string; destinationCode: string; ratePerKg: number }>,
) => {
  const requiredCodes = new Set(REQUIRED_ZONE_CODES)
  const seenPairs = new Set<string>()

  for (const row of rows) {
    if (!requiredCodes.has(row.originCode as ZoneCode)) {
      throw new Error(`Unexpected origin zone code in CSV: ${row.originCode}`)
    }
    if (!requiredCodes.has(row.destinationCode as ZoneCode)) {
      throw new Error(`Unexpected destination zone code in CSV: ${row.destinationCode}`)
    }
    if (!Number.isFinite(row.ratePerKg)) {
      throw new Error(
        `Invalid rate_per_kg for ${row.originCode} -> ${row.destinationCode}: ${row.ratePerKg}`,
      )
    }

    const pairKey = `${row.originCode}::${row.destinationCode}`
    if (seenPairs.has(pairKey)) {
      throw new Error(`Duplicate lane found in CSV: ${row.originCode} -> ${row.destinationCode}`)
    }
    seenPairs.add(pairKey)
  }

  const expectedPairs = REQUIRED_ZONE_CODES.length * REQUIRED_ZONE_CODES.length
  if (seenPairs.size !== expectedPairs) {
    throw new Error(
      `CSV must contain exactly ${expectedPairs} zone pairs, but found ${seenPairs.size}`,
    )
  }
}

const ensureBasicPlan = async () => {
  const [basicPlan] = await db.select().from(plans).where(eq(plans.name, PLAN_NAME)).limit(1)
  if (!basicPlan) {
    throw new Error(`Plan "${PLAN_NAME}" not found`)
  }
  return basicPlan
}

const ensureDelhiverySurfaceCourier = async () => {
  const [surfaceCourier] = await db
    .select()
    .from(couriers)
    .where(
      and(
        eq(couriers.id, DELHIVERY_SURFACE_COURIER_ID),
        eq(couriers.serviceProvider, DELHIVERY_SERVICE_PROVIDER),
      ),
    )
    .limit(1)

  if (!surfaceCourier) {
    throw new Error('Delhivery Surface courier (id 100, provider delhivery) not found')
  }

  return surfaceCourier
}

const loadExistingB2BZones = async () =>
  db
    .select({
      id: zones.id,
      code: zones.code,
      name: zones.name,
    })
    .from(zones)
    .where(eq(zones.business_type, 'B2B'))
    .orderBy(zones.code)

const ensureZoneSetMatchesMatrix = async () => {
  const existingZones = await loadExistingB2BZones()
  const existingIds = existingZones.map((zone) => zone.id)
  const existingCodeSet = new Set(existingZones.map((zone) => zone.code))
  const requiredCodeSet = new Set(REQUIRED_ZONE_CODES)
  const exactMatch =
    existingZones.length === REQUIRED_ZONE_CODES.length &&
    REQUIRED_ZONE_CODES.every((code) => existingCodeSet.has(code))

  if (exactMatch) {
    return existingZones
  }

  if (existingIds.length) {
    const [[pincodeSummary], [stateSummary], [rateSummary]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(b2bPincodes)
        .where(inArray(b2bPincodes.zone_id, existingIds)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(b2bZoneStates)
        .where(inArray(b2bZoneStates.zone_id, existingIds)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(b2bZoneToZoneRates)
        .where(
          or(
            inArray(b2bZoneToZoneRates.origin_zone_id, existingIds),
            inArray(b2bZoneToZoneRates.destination_zone_id, existingIds),
          ),
        ),
    ])

    if (
      Number(pincodeSummary?.count || 0) > 0 ||
      Number(stateSummary?.count || 0) > 0 ||
      Number(rateSummary?.count || 0) > 0
    ) {
      throw new Error(
        `Existing B2B zones are already in use and do not match the CSV codes. Current codes: ${[
          ...existingCodeSet,
        ].join(', ')}`,
      )
    }

    await db.transaction(async (tx) => {
      await tx.delete(b2bZoneToZoneRates).where(
        or(
          inArray(b2bZoneToZoneRates.origin_zone_id, existingIds),
          inArray(b2bZoneToZoneRates.destination_zone_id, existingIds),
        ),
      )
      await tx.delete(b2bZoneStates).where(inArray(b2bZoneStates.zone_id, existingIds))
      await tx.delete(b2bPincodes).where(inArray(b2bPincodes.zone_id, existingIds))
      await tx.delete(zones).where(inArray(zones.id, existingIds))
    })
  }

  for (const code of REQUIRED_ZONE_CODES) {
    await db.insert(zones).values({
      code,
      name: code,
      description: `Delhivery Surface B2B zone ${code}`,
      business_type: 'B2B',
      states: [],
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  const createdZones = await loadExistingB2BZones()
  if (
    createdZones.length !== REQUIRED_ZONE_CODES.length ||
    !REQUIRED_ZONE_CODES.every((code) => createdZones.some((zone) => zone.code === code))
  ) {
    throw new Error('Failed to create the expected B2B zones for the rate matrix')
  }

  return createdZones
}

async function seedBasicB2BDelhiverySurfaceRateMatrix() {
  console.log(`Using CSV: ${CSV_PATH}`)

  const rows = parseCsv(CSV_PATH)
  assertExpectedMatrix(rows)

  const [basicPlan, surfaceCourier, zoneRows] = await Promise.all([
    ensureBasicPlan(),
    ensureDelhiverySurfaceCourier(),
    ensureZoneSetMatchesMatrix(),
  ])

  const zoneIdByCode = new Map(zoneRows.map((zone) => [zone.code, zone.id]))
  const zoneIds = zoneRows.map((zone) => zone.id)

  await db.transaction(async (tx) => {
    await tx.delete(b2bZoneToZoneRates).where(
      and(
        eq(b2bZoneToZoneRates.plan_id, basicPlan.id),
        eq(b2bZoneToZoneRates.courier_id, surfaceCourier.id),
        eq(b2bZoneToZoneRates.service_provider, surfaceCourier.serviceProvider),
        inArray(b2bZoneToZoneRates.origin_zone_id, zoneIds),
        inArray(b2bZoneToZoneRates.destination_zone_id, zoneIds),
      ),
    )

    await tx.insert(b2bZoneToZoneRates).values(
      rows.map((row) => ({
        plan_id: basicPlan.id,
        origin_zone_id: zoneIdByCode.get(row.originCode)!,
        destination_zone_id: zoneIdByCode.get(row.destinationCode)!,
        courier_id: surfaceCourier.id,
        service_provider: surfaceCourier.serviceProvider,
        rate_per_kg: row.ratePerKg.toString(),
        created_at: new Date(),
        updated_at: new Date(),
      })),
    )
  })

  const [rateSummary] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(b2bZoneToZoneRates)
    .where(
      and(
        eq(b2bZoneToZoneRates.plan_id, basicPlan.id),
        eq(b2bZoneToZoneRates.courier_id, surfaceCourier.id),
        eq(b2bZoneToZoneRates.service_provider, surfaceCourier.serviceProvider),
        inArray(b2bZoneToZoneRates.origin_zone_id, zoneIds),
        inArray(b2bZoneToZoneRates.destination_zone_id, zoneIds),
      ),
    )

  console.log(
    JSON.stringify(
      {
        plan: { id: basicPlan.id, name: basicPlan.name },
        courier: {
          id: surfaceCourier.id,
          name: surfaceCourier.name,
          serviceProvider: surfaceCourier.serviceProvider,
        },
        zoneCodes: REQUIRED_ZONE_CODES,
        seededRateCount: rateSummary?.count ?? 0,
      },
      null,
      2,
    ),
  )
}

seedBasicB2BDelhiverySurfaceRateMatrix()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (error: any) => {
    console.error('Failed to seed Basic B2B Delhivery Surface rate matrix:', error?.message || error)
    console.error(error)
    await pool.end()
    process.exit(1)
  })
