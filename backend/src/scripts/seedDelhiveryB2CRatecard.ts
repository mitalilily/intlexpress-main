import { randomUUID } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { couriers, plans, shippingRates, zones } from '../schema/schema'

type CourierSeed = {
  id: number
  name: string
  serviceProvider: string
  mode: 'Air' | 'Surface'
  businessTypes: ('b2c' | 'b2b')[]
  extraForward: number
  extraRto: number
}

type ZoneSeed = {
  code: string
  name: string
  description: string
  region: string
  states?: string[]
  metadata?: Record<string, unknown>
}

const courierSeeds: CourierSeed[] = [
  {
    id: 99,
    name: 'Delhivery Metro Air',
    serviceProvider: 'delhivery',
    mode: 'Air',
    businessTypes: ['b2c'],
    extraForward: 25,
    extraRto: 10,
  },
  {
    id: 100,
    name: 'Delhivery Metro Surface',
    serviceProvider: 'delhivery',
    mode: 'Surface',
    businessTypes: ['b2c'],
    extraForward: 5,
    extraRto: 5,
  },
]

const zoneSeeds: ZoneSeed[] = [
  {
    code: 'A',
    name: 'Zone A',
    description: 'C2C Surface Rate Card category: Within City. Pickup and delivery are in the same city.',
    region: 'Within City',
    metadata: { source: 'C2C Surface Rate Card', category: 'Within City' },
  },
  {
    code: 'B',
    name: 'Zone B',
    description: 'C2C Surface Rate Card category: Regional single connection and less than 500 kms.',
    region: 'Regional',
    metadata: { source: 'C2C Surface Rate Card', category: 'Regional single connection <500 kms' },
  },
  {
    code: 'C1',
    name: 'Zone C1',
    description: 'C2C Surface Rate Card category: Metro to Metro, 500-1400 kms.',
    region: 'Metro to Metro',
    metadata: { source: 'C2C Surface Rate Card', category: 'Metro to Metro 500-1400 kms' },
  },
  {
    code: 'C2',
    name: 'Zone C2',
    description: 'C2C Surface Rate Card category: Metro to Metro, 1400-2400 kms.',
    region: 'Metro to Metro',
    metadata: { source: 'C2C Surface Rate Card', category: 'Metro to Metro 1400-2400 kms' },
  },
  {
    code: 'D1',
    name: 'Zone D1',
    description: 'C2C Surface Rate Card category: Rest of India - Zone D, 1400-2400 kms.',
    region: 'Rest of India',
    metadata: { source: 'C2C Surface Rate Card', category: 'Rest of India Zone D 1400-2400 kms' },
  },
  {
    code: 'D2',
    name: 'Zone D2',
    description: 'C2C Surface Rate Card category: Rest of India - Zone D1, 1400-2400 kms.',
    region: 'Rest of India',
    metadata: { source: 'C2C Surface Rate Card', category: 'Rest of India Zone D1 1400-2400 kms' },
  },
  {
    code: 'E',
    name: 'Zone E',
    description: 'C2C Surface Rate Card category: Jammu, HP, and North East excluding Manipur.',
    region: 'Special Region',
    states: ['Jammu and Kashmir', 'Himachal Pradesh', 'Arunachal Pradesh', 'Assam', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'],
    metadata: { source: 'C2C Surface Rate Card', category: 'Jammu, HP, North East excluding Manipur', excludes: ['Manipur'] },
  },
  {
    code: 'F',
    name: 'Zone F',
    description: 'C2C Surface Rate Card category: Kashmir, Manipur, Ladakh, Andaman and Nicobar.',
    region: 'Special Region',
    states: ['Jammu and Kashmir', 'Manipur', 'Ladakh', 'Andaman and Nicobar Islands'],
    metadata: { source: 'C2C Surface Rate Card', category: 'Kashmir, Manipur, Ladakh, Andaman and Nicobar' },
  },
]

const forwardRateGuide: Record<string, number> = {
  A: 101,
  B: 106,
  C1: 107,
  C2: 109,
  D1: 110,
  D2: 111,
  E: 116,
  F: 122,
}

const rtoRateGuide: Record<string, number> = {
  A: 101,
  B: 106,
  C1: 107,
  C2: 109,
  D1: 110,
  D2: 111,
  E: 116,
  F: 122,
}

const codCharges = 45.0
const codPercent = 1.5
const otherCharges = 18.0
const minWeight = 0.5

async function ensureBasicPlan() {
  const [existing] = await db.select().from(plans).where(eq(plans.name, 'Basic')).limit(1)
  if (existing) return existing

  const [plan] = await db
    .insert(plans)
    .values({ id: randomUUID(), name: 'Basic', description: 'Default B2C plan', is_active: true })
    .returning()

  console.log('🌱 Inserted Basic plan because it did not exist yet')
  return plan
}

async function upsertCouriers() {
  for (const courier of courierSeeds) {
    await db
      .insert(couriers)
      .values({
        id: courier.id,
        name: courier.name,
        serviceProvider: courier.serviceProvider,
        businessType: courier.businessTypes,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [couriers.id, couriers.serviceProvider],
        set: {
          name: courier.name,
          updatedAt: new Date(),
        },
      })
    console.log(`✅ Ensured courier ${courier.name} (ID ${courier.id}) exists`)
  }
}

async function upsertZones() {
  const insertedZones: { id: string; code: string; name: string }[] = []

  for (const seed of zoneSeeds) {
    const [zoneRow] = await db
      .insert(zones)
      .values({
        code: seed.code,
        name: seed.name,
        description: seed.description,
        region: seed.region,
        business_type: 'B2C',
        metadata: seed.metadata ?? null,
        states: seed.states ?? [],
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [zones.code, zones.business_type],
        set: {
          name: seed.name,
          description: seed.description,
          region: seed.region,
          metadata: seed.metadata ?? null,
          states: seed.states ?? [],
          updated_at: new Date(),
        },
      })
      .returning()

    insertedZones.push({ id: zoneRow.id, code: zoneRow.code, name: zoneRow.name })
    console.log(`✅ Upserted zone ${seed.code} (${seed.name})`)
  }

  const targetCodes = new Set(zoneSeeds.map((seed) => seed.code))
  const existingB2CZones = await db
    .select({ id: zones.id, code: zones.code })
    .from(zones)
    .where(eq(zones.business_type, 'B2C'))

  for (const staleZone of existingB2CZones) {
    if (targetCodes.has(staleZone.code)) continue
    await db.delete(shippingRates).where(eq(shippingRates.zone_id, staleZone.id))
    await db.delete(zones).where(eq(zones.id, staleZone.id))
    console.log(`Removed stale B2C zone ${staleZone.code}`)
  }

  return insertedZones
}

async function purgeExistingRates() {
  const courierIds = courierSeeds.map((courier) => courier.id)
  await db
    .delete(shippingRates)
    .where(and(eq(shippingRates.business_type, 'b2c'), inArray(shippingRates.courier_id, courierIds)))
  console.log('🧹 Removed existing B2C rates for the configured Delhivery couriers to avoid duplicates')
}

async function seedRates(planId: string, insertedZones: { id: string; code: string }[]) {
  const zoneMap = insertedZones.reduce<Record<string, string>>((acc, zone) => {
    acc[zone.code] = zone.id
    return acc
  }, {})

  type ShippingRateInsert = {
    plan_id: string
    courier_id: number
    courier_name: string
    service_provider: string
    mode: string
    business_type: string
    min_weight: string
    zone_id: string
    type: 'forward' | 'rto'
    rate: string
    cod_charges: string
    cod_percent: string
    other_charges: string
  }

  const rateRecords: ShippingRateInsert[] = []
  const targetZoneCodes = Object.keys(zoneMap)

  for (const code of targetZoneCodes) {
    const zoneId = zoneMap[code]
    const baseForward = forwardRateGuide[code] ?? 150
    const baseRto = rtoRateGuide[code] ?? 90

    for (const courier of courierSeeds) {
      const forwardRate = baseForward + courier.extraForward
      const rtoRate = baseRto + courier.extraRto

      rateRecords.push({
        plan_id: planId,
        courier_id: courier.id,
        courier_name: courier.name,
        service_provider: courier.serviceProvider,
        mode: courier.mode,
        business_type: 'b2c',
        min_weight: minWeight.toFixed(2),
        zone_id: zoneId,
        type: 'forward',
        rate: forwardRate.toFixed(2),
        cod_charges: codCharges.toFixed(2),
        cod_percent: codPercent.toFixed(2),
        other_charges: otherCharges.toFixed(2),
      })

      rateRecords.push({
        plan_id: planId,
        courier_id: courier.id,
        courier_name: courier.name,
        service_provider: courier.serviceProvider,
        mode: courier.mode,
        business_type: 'b2c',
        min_weight: minWeight.toFixed(2),
        zone_id: zoneId,
        type: 'rto',
        rate: rtoRate.toFixed(2),
        cod_charges: codCharges.toFixed(2),
        cod_percent: codPercent.toFixed(2),
        other_charges: otherCharges.toFixed(2),
      })
    }
  }

  if (!rateRecords.length) {
    console.warn('⚠️ No rate records to insert; check the zone seeds')
    return
  }

  await db.insert(shippingRates).values(rateRecords)
  console.log(`📦 Inserted ${rateRecords.length} dummy B2C rate entries for Delhivery couriers`)
}

async function main() {
  try {
    const plan = await ensureBasicPlan()
    await upsertCouriers()
    const zones = await upsertZones()
    await purgeExistingRates()
    await seedRates(plan.id, zones)
    console.log('🎉 Delhivery B2C rate card seeding complete')
  } catch (error) {
    console.error('❌ Error while seeding Delhivery metadata:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
