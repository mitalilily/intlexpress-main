import { and, eq, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { shippingRates } from '../models/schema/shippingRates'
import { zones } from '../models/schema/zones'

const C2C_B2C_ZONES = [
  {
    id: 'b10596c6-01bf-4061-a460-ab2e254aa462',
    code: 'A',
    name: 'Zone A',
    description:
      'C2C Surface Rate Card category: Within City. Pickup and delivery are in the same city.',
    region: 'Within City',
    states: [] as string[],
    metadata: { source: 'C2C Surface Rate Card', category: 'Within City' },
  },
  {
    id: 'a5a4fc8c-7f7e-4657-98be-285dcd4fcfb2',
    code: 'B',
    name: 'Zone B',
    description:
      'C2C Surface Rate Card category: Regional single connection and less than 500 kms.',
    region: 'Regional',
    states: [] as string[],
    metadata: { source: 'C2C Surface Rate Card', category: 'Regional single connection <500 kms' },
  },
  {
    id: 'a0a126ca-112e-4bcd-b07f-eaf428228325',
    code: 'C1',
    name: 'Zone C1',
    description: 'C2C Surface Rate Card category: Metro to Metro, 500-1400 kms.',
    region: 'Metro to Metro',
    states: [] as string[],
    metadata: { source: 'C2C Surface Rate Card', category: 'Metro to Metro 500-1400 kms' },
  },
  {
    id: '6eb63305-f569-4e57-96aa-e54161b33e9d',
    code: 'C2',
    name: 'Zone C2',
    description: 'C2C Surface Rate Card category: Metro to Metro, 1400-2400 kms.',
    region: 'Metro to Metro',
    states: [] as string[],
    metadata: { source: 'C2C Surface Rate Card', category: 'Metro to Metro 1400-2400 kms' },
  },
  {
    id: '1d887656-c855-4caa-a607-74c1aad2a4fd',
    code: 'D1',
    name: 'Zone D1',
    description: 'C2C Surface Rate Card category: Rest of India - Zone D, 1400-2400 kms.',
    region: 'Rest of India',
    states: [] as string[],
    metadata: { source: 'C2C Surface Rate Card', category: 'Rest of India Zone D 1400-2400 kms' },
  },
  {
    id: '4a72f47e-b1b5-4248-8f0d-efadfef1448e',
    code: 'D2',
    name: 'Zone D2',
    description: 'C2C Surface Rate Card category: Rest of India - Zone D1, 1400-2400 kms.',
    region: 'Rest of India',
    states: [] as string[],
    metadata: { source: 'C2C Surface Rate Card', category: 'Rest of India Zone D1 1400-2400 kms' },
  },
  {
    id: 'f1194f64-d02b-4ec4-b675-482131f69c34',
    code: 'E',
    name: 'Zone E',
    description: 'C2C Surface Rate Card category: Jammu, HP, and North East excluding Manipur.',
    region: 'Special Region',
    states: [
      'Jammu and Kashmir',
      'Himachal Pradesh',
      'Arunachal Pradesh',
      'Assam',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Sikkim',
      'Tripura',
    ],
    metadata: {
      source: 'C2C Surface Rate Card',
      category: 'Jammu, HP, North East excluding Manipur',
      excludes: ['Manipur'],
    },
  },
  {
    id: 'c78ad99b-65ee-4920-8550-b7ba3d11d224',
    code: 'F',
    name: 'Zone F',
    description: 'C2C Surface Rate Card category: Kashmir, Manipur, Ladakh, Andaman and Nicobar.',
    region: 'Special Region',
    states: ['Jammu and Kashmir', 'Manipur', 'Ladakh', 'Andaman and Nicobar Islands'],
    metadata: {
      source: 'C2C Surface Rate Card',
      category: 'Kashmir, Manipur, Ladakh, Andaman and Nicobar',
    },
  },
]

async function seedB2CZones() {
  try {
    console.log('Ensuring C2C B2C zones...')

    for (const zone of C2C_B2C_ZONES) {
      const [existingByCode] = await db
        .select({ id: zones.id })
        .from(zones)
        .where(and(eq(zones.business_type, 'B2C'), eq(zones.code, zone.code)))
        .limit(1)

      if (existingByCode?.id && existingByCode.id !== zone.id) {
        await db
          .update(shippingRates)
          .set({ zone_id: zone.id })
          .where(eq(shippingRates.zone_id, existingByCode.id))

        await db.delete(zones).where(eq(zones.id, existingByCode.id))
      }

      await db
        .insert(zones)
        .values({
          id: zone.id,
          code: zone.code,
          name: zone.name,
          description: zone.description,
          region: zone.region,
          business_type: 'B2C',
          metadata: zone.metadata,
          states: zone.states,
          created_at: sql`NOW()`,
          updated_at: sql`NOW()`,
        })
        .onConflictDoUpdate({
          target: zones.id,
          set: {
            code: zone.code,
            name: zone.name,
            description: zone.description,
            region: zone.region,
            business_type: 'B2C',
            metadata: zone.metadata,
            states: zone.states,
            updated_at: sql`NOW()`,
          },
        })

      console.log(`Upserted C2C B2C zone: ${zone.code} (${zone.name})`)
    }

    const targetCodes = new Set(C2C_B2C_ZONES.map((zone) => zone.code))
    const existingB2CZones = await db
      .select({ id: zones.id, code: zones.code })
      .from(zones)
      .where(eq(zones.business_type, 'B2C'))

    for (const staleZone of existingB2CZones) {
      if (targetCodes.has(staleZone.code)) continue
      await db.delete(shippingRates).where(eq(shippingRates.zone_id, staleZone.id))
      await db.delete(zones).where(eq(zones.id, staleZone.id))
      console.log(`Removed stale B2C zone: ${staleZone.code}`)
    }

    console.log('C2C B2C zones ensured successfully')
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('Error ensuring C2C B2C zones:', error)
    await pool.end().catch(() => undefined)
    process.exit(1)
  }
}

seedB2CZones()
