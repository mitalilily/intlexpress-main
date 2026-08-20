import { and, eq, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { shippingRates } from '../models/schema/shippingRates'
import { zones } from '../models/schema/zones'

const ORIGINAL_B2C_ZONES = [
  {
    id: 'b10596c6-01bf-4061-a460-ab2e254aa462',
    code: 'METRO_TO_METRO',
    name: 'Metro to Metro',
    description:
      'Shipments moving between major metro cities, typically with the fastest service coverage and standard metro lane pricing.',
    region: 'Metro to Metro',
    states: [] as string[],
    metadata: {},
  },
  {
    id: 'a5a4fc8c-7f7e-4657-98be-285dcd4fcfb2',
    code: 'ROI',
    name: 'Rest of India',
    description:
      'Shipments that do not fall into metro, same-city, same-state, same-region, or special-zone categories and are served through the wider national network.',
    region: 'Rest of India',
    states: [] as string[],
    metadata: {},
  },
  {
    id: 'a0a126ca-112e-4bcd-b07f-eaf428228325',
    code: 'SPECIAL_ZONE',
    name: 'Special Zone',
    description:
      'Shipments going to or from exceptional service areas that require extra operational handling, routing control, or surcharge treatment outside the regular network.',
    region: 'Special Zone',
    states: [] as string[],
    metadata: {},
  },
  {
    id: '6eb63305-f569-4e57-96aa-e54161b33e9d',
    code: 'WITHIN_CITY',
    name: 'Within City',
    description:
      'Shipments where pickup and delivery happen inside the same city boundary, including eligible north-east metro movements treated as same-city lanes.',
    region: 'Within City',
    states: ['Nagaland', 'Mizoram', 'Manipur', 'Meghalaya', 'Assam', 'Sikkim'],
    metadata: {},
  },
  {
    id: '1d887656-c855-4caa-a607-74c1aad2a4fd',
    code: 'WITHIN_REGION',
    name: 'Within Region',
    description:
      'Shipments travelling within a defined neighbouring-state region, where movement stays regional but crosses city or state boundaries.',
    region: 'Within Region',
    states: [] as string[],
    metadata: {},
  },
  {
    id: '4a72f47e-b1b5-4248-8f0d-efadfef1448e',
    code: 'WITHIN_STATE',
    name: 'Within State',
    description:
      'Shipments whose pickup and delivery locations remain within the same state, excluding lanes already classified as within-city.',
    region: 'Within State',
    states: [] as string[],
    metadata: {},
  },
]

async function seedB2CZones() {
  try {
    console.log('Ensuring original B2C zones...')

    for (const zone of ORIGINAL_B2C_ZONES) {
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

      console.log(`Upserted original B2C zone: ${zone.code} (${zone.name})`)
    }

    console.log('Original B2C zones ensured successfully')
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('Error ensuring original B2C zones:', error)
    await pool.end().catch(() => undefined)
    process.exit(1)
  }
}

seedB2CZones()
