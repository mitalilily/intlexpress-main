import { eq, and } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { zones } from '../models/schema/zones'

const C2C_B2C_ZONES = [
  {
    code: 'ZONE_A',
    name: 'Zone A',
    description: 'Within City',
    region: 'Within City',
  },
  {
    code: 'ZONE_B',
    name: 'Zone B',
    description: 'Regional single connection and less than 500 km',
    region: 'Regional',
  },
  {
    code: 'ZONE_C1',
    name: 'Zone C1',
    description: 'Metro to Metro, 500-1400 km',
    region: 'Metro to Metro',
  },
  {
    code: 'ZONE_C2',
    name: 'Zone C2',
    description: 'Zone C, 1400-2400 km',
    region: 'Zone C',
  },
  {
    code: 'ZONE_D1',
    name: 'Zone D1',
    description: 'Rest of India / Zone D, 1400-2400 km',
    region: 'Rest of India',
  },
  {
    code: 'ZONE_D2',
    name: 'Zone D2',
    description: 'Zone D1, 1400-2400 km',
    region: 'Rest of India',
  },
  {
    code: 'ZONE_E',
    name: 'Zone E',
    description: 'Jammu, HP, North East excluding Manipur',
    region: 'Special Zone',
  },
  {
    code: 'ZONE_F',
    name: 'Zone F',
    description: 'Kashmir, Manipur, Ladakh, Andaman and Nicobar',
    region: 'Special Zone',
  },
]

async function ensureC2CB2CZones() {
  let created = 0
  let updated = 0

  for (const zone of C2C_B2C_ZONES) {
    const [existing] = await db
      .select({ id: zones.id })
      .from(zones)
      .where(and(eq(zones.code, zone.code), eq(zones.business_type, 'B2C')))
      .limit(1)

    if (existing?.id) {
      await db
        .update(zones)
        .set({
          name: zone.name,
          description: zone.description,
          region: zone.region,
          updated_at: new Date(),
        })
        .where(eq(zones.id, existing.id))
      updated += 1
      continue
    }

    await db.insert(zones).values({
      code: zone.code,
      name: zone.name,
      description: zone.description,
      region: zone.region,
      business_type: 'B2C',
      metadata: { source: 'c2c_rate_card' },
    })
    created += 1
  }

  console.log(`C2C B2C zones ensured. Created: ${created}, updated: ${updated}`)
}

ensureC2CB2CZones()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed to ensure C2C B2C zones:', error)
    pool.end().finally(() => process.exit(1))
  })
