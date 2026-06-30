import * as dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { eq, inArray, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { b2bPincodes, b2bZoneStates, zones } from '../models/schema/zones'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

const REQUIRED_ZONE_CODES = ['N1', 'N2', 'E', 'NE', 'W1', 'W2', 'S1', 'S2', 'Central'] as const
const PRICING_SHEET_NAME = 'CFT_Pricing '
const PINCODE_SHEET_NAME = 'B2B_Pincode_List'
const INSERT_CHUNK_SIZE = 1000

const WORKBOOK_PATH = process.argv[2]

type ZoneCode = (typeof REQUIRED_ZONE_CODES)[number]

type PricingRow = [string, string, number, string, string, string, string, string, string]

type PincodeSheetRow = {
  Pin: string | number
  'Dispatch Center': string
  'Origin Center': string
  'Return Center': string
  'Facility City': string
  'Facility State': string
  ODA: boolean | number | string
}

type WorkbookPincodeRecord = {
  pincode: string
  city: string
  state: string
  zoneCode: ZoneCode
  isOda: boolean
  dispatchCenter: string
  originCenter: string
  returnCenter: string
  mappingBasis: 'state' | 'city_override'
}

const ZONE_DETAILS: Record<
  ZoneCode,
  { name: string; description: string; region: string; states: string[] }
> = {
  N1: {
    name: 'Zone N1',
    description: 'Northern cluster 1 from the CFT pricing workbook.',
    region: 'North',
    states: [
      'Chandigarh',
      'Delhi',
      'Haryana',
      'Himachal Pradesh',
      'Jammu & Kashmir',
      'Punjab',
    ],
  },
  N2: {
    name: 'Zone N2',
    description: 'Northern cluster 2 from the CFT pricing workbook.',
    region: 'North',
    states: ['Uttar Pradesh', 'Uttarakhand'],
  },
  E: {
    name: 'Zone E',
    description: 'Eastern cluster from the CFT pricing workbook.',
    region: 'East',
    states: ['Bihar', 'Jharkhand', 'Orissa', 'West Bengal'],
  },
  NE: {
    name: 'Zone NE',
    description: 'North-east cluster from the CFT pricing workbook.',
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
  W1: {
    name: 'Zone W1',
    description: 'Western cluster 1 from the CFT pricing workbook.',
    region: 'West',
    states: ['Dadra and Nagar Haveli', 'Daman & Diu', 'Gujarat', 'Rajasthan'],
  },
  W2: {
    name: 'Zone W2',
    description: 'Western cluster 2 from the CFT pricing workbook.',
    region: 'West',
    states: ['Goa', 'Maharashtra'],
  },
  S1: {
    name: 'Zone S1',
    description: 'Southern cluster 1 from the CFT pricing workbook.',
    region: 'South',
    states: ['Andhra Pradesh', 'Karnataka', 'Telangana'],
  },
  S2: {
    name: 'Zone S2',
    description: 'Southern cluster 2 from the CFT pricing workbook.',
    region: 'South',
    states: ['Kerala', 'Pondicherry', 'Tamil Nadu'],
  },
  Central: {
    name: 'Zone Central',
    description: 'Central cluster from the CFT pricing workbook.',
    region: 'Central',
    states: ['Chhattisgarh', 'Madhya Pradesh'],
  },
}

const SPECIAL_STATE_ZONE_EXPECTATIONS: Record<string, ZoneCode> = {
  'Arunachal Pradesh': 'NE',
  Assam: 'NE',
  'Himachal Pradesh': 'N1',
  'Jammu & Kashmir': 'N1',
  Manipur: 'NE',
  Meghalaya: 'NE',
  Mizoram: 'NE',
  Nagaland: 'NE',
  Sikkim: 'NE',
  Tripura: 'NE',
}

const CITY_OVERRIDES: Array<{ city: string; state: string; zoneCode: ZoneCode }> = [
  { city: 'Baddi', state: 'Himachal Pradesh', zoneCode: 'N1' },
  { city: 'Guwahati', state: 'Assam', zoneCode: 'NE' },
  { city: 'Jammu', state: 'Jammu & Kashmir', zoneCode: 'N1' },
]

const normalize = (value: unknown) => String(value ?? '').trim()
const normalizeKey = (value: unknown) =>
  normalize(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const truthy = (value: unknown) => {
  if (typeof value === 'boolean') return value
  const normalized = normalize(value).toLowerCase()
  return ['1', 'true', 'yes', 'y'].includes(normalized)
}

const stateToZoneMap = new Map<string, ZoneCode>(
  Object.entries(ZONE_DETAILS).flatMap(([zoneCode, details]) =>
    details.states.map((state) => [normalizeKey(state), zoneCode as ZoneCode] as const),
  ),
)

const cityOverrideMap = new Map<string, ZoneCode>(
  CITY_OVERRIDES.map((entry) => [
    `${normalizeKey(entry.city)}|${normalizeKey(entry.state)}`,
    entry.zoneCode,
  ]),
)

const ensureWorkbookPath = () => {
  const workbookPath = normalize(WORKBOOK_PATH)
  if (!workbookPath) {
    throw new Error(
      'Workbook path is required. Usage: tsx src/scripts/syncCftB2BZoneMapping.ts "C:\\path\\to\\CFT_Pricing_Final.xlsx"',
    )
  }

  const resolvedPath = path.resolve(workbookPath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Workbook not found: ${resolvedPath}`)
  }

  return resolvedPath
}

const parseWorkbook = (workbookPath: string) => {
  const workbook = XLSX.readFile(workbookPath)
  const pricingSheet = workbook.Sheets[PRICING_SHEET_NAME]
  const pincodeSheet = workbook.Sheets[PINCODE_SHEET_NAME]

  if (!pricingSheet) {
    throw new Error(`Sheet "${PRICING_SHEET_NAME}" not found in workbook`)
  }
  if (!pincodeSheet) {
    throw new Error(`Sheet "${PINCODE_SHEET_NAME}" not found in workbook`)
  }

  const pricingRows = XLSX.utils.sheet_to_json<PricingRow>(pricingSheet, {
    header: 1,
    defval: '',
    raw: true,
  })
  const pincodeRows = XLSX.utils.sheet_to_json<PincodeSheetRow>(pincodeSheet, {
    defval: '',
    raw: true,
  })

  return { pricingRows, pincodeRows }
}

const validateWorkbookOverrides = (pricingRows: PricingRow[]) => {
  const rateRows = pricingRows
    .slice(99)
    .filter(
      (row) =>
        REQUIRED_ZONE_CODES.includes(normalize(row[0]) as ZoneCode) &&
        normalize(row[1]) &&
        normalize(row[3]) === 'Zone' &&
        ['State', 'City'].includes(normalize(row[6])),
    )

  const grouped = new Map<string, PricingRow[]>()
  for (const row of rateRows) {
    const destination = normalize(row[1])
    const destinationKind = normalize(row[6])
    const groupKey = `${destinationKind}|${destination}`
    const current = grouped.get(groupKey) || []
    current.push(row)
    grouped.set(groupKey, current)
  }

  const expectedStateKeys = new Set(Object.keys(SPECIAL_STATE_ZONE_EXPECTATIONS))
  const expectedCityKeys = new Set(
    CITY_OVERRIDES.map((entry) => `${entry.city.toLowerCase()}-${entry.state.toLowerCase()}`),
  )

  const workbookStateKeys = new Set<string>()
  const workbookCityKeys = new Set<string>()

  for (const [groupKey, rows] of grouped.entries()) {
    if (rows.length !== REQUIRED_ZONE_CODES.length) {
      throw new Error(`Expected ${REQUIRED_ZONE_CODES.length} rows for ${groupKey}, found ${rows.length}`)
    }

    const sources = rows.map((row) => normalize(row[0]))
    for (const zoneCode of REQUIRED_ZONE_CODES) {
      if (!sources.includes(zoneCode)) {
        throw new Error(`Missing source zone ${zoneCode} for ${groupKey}`)
      }
    }

    const [kind, destination] = groupKey.split('|')
    if (kind === 'State') {
      workbookStateKeys.add(destination)
    }
    if (kind === 'City') {
      workbookCityKeys.add(destination.toLowerCase())
    }
  }

  for (const stateName of expectedStateKeys) {
    if (!workbookStateKeys.has(stateName)) {
      throw new Error(`Workbook special state mapping missing: ${stateName}`)
    }
  }

  const expectedWorkbookCityKeys = new Set(
    CITY_OVERRIDES.map((entry) => `${entry.city.toLowerCase()}-${entry.state.toLowerCase()}`),
  )

  const actualWorkbookCityKeys = new Set(
    Array.from(workbookCityKeys).map((value) => value.replace(/\s+/g, ' ').trim()),
  )

  for (const expectedKey of expectedWorkbookCityKeys) {
    if (!actualWorkbookCityKeys.has(expectedKey)) {
      throw new Error(`Workbook special city mapping missing: ${expectedKey}`)
    }
  }
}

const buildPincodeRecords = (pincodeRows: PincodeSheetRow[]) => {
  const records: WorkbookPincodeRecord[] = []
  const uncoveredStates = new Set<string>()
  const seenPincodes = new Set<string>()

  for (const row of pincodeRows) {
    const pincode = normalize(row.Pin).replace(/\D/g, '')
    const city = normalize(row['Facility City'])
    const state = normalize(row['Facility State'])

    if (!pincode || !city || !state) {
      continue
    }

    if (!/^\d{6}$/.test(pincode)) {
      continue
    }

    const cityOverrideKey = `${normalizeKey(city)}|${normalizeKey(state)}`
    const zoneCodeFromOverride = cityOverrideMap.get(cityOverrideKey)
    const zoneCodeFromState = stateToZoneMap.get(normalizeKey(state))
    const zoneCode = zoneCodeFromOverride || zoneCodeFromState

    if (!zoneCode) {
      uncoveredStates.add(state)
      continue
    }

    if (seenPincodes.has(pincode)) {
      continue
    }
    seenPincodes.add(pincode)

    records.push({
      pincode,
      city,
      state,
      zoneCode,
      isOda: truthy(row.ODA),
      dispatchCenter: normalize(row['Dispatch Center']),
      originCenter: normalize(row['Origin Center']),
      returnCenter: normalize(row['Return Center']),
      mappingBasis: zoneCodeFromOverride ? 'city_override' : 'state',
    })
  }

  if (uncoveredStates.size > 0) {
    throw new Error(
      `Workbook contains states without a zone mapping: ${Array.from(uncoveredStates).sort().join(', ')}`,
    )
  }

  return records
}

const loadExistingB2BZones = async () =>
  db
    .select({
      id: zones.id,
      code: zones.code,
      states: zones.states,
    })
    .from(zones)
    .where(eq(zones.business_type, 'B2B'))

const ensureRequiredZones = async () => {
  for (const zoneCode of REQUIRED_ZONE_CODES) {
    const details = ZONE_DETAILS[zoneCode]
    await db
      .insert(zones)
      .values({
        code: zoneCode,
        name: details.name,
        description: details.description,
        region: details.region,
        business_type: 'B2B',
        states: details.states,
        metadata: {
          sourceWorkbook: 'CFT_Pricing_Final.xlsx',
          zoneCode,
        },
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflictDoNothing({
        target: [zones.code, zones.business_type],
      })
  }

  const existingZones = await loadExistingB2BZones()
  const zoneIdByCode = new Map(existingZones.map((zone) => [zone.code, zone.id]))

  for (const zoneCode of REQUIRED_ZONE_CODES) {
    const zoneId = zoneIdByCode.get(zoneCode)
    if (!zoneId) {
      throw new Error(`Required B2B zone ${zoneCode} is missing`)
    }

    const details = ZONE_DETAILS[zoneCode]
    await db
      .update(zones)
      .set({
        name: details.name,
        description: details.description,
        region: details.region,
        states: details.states,
        metadata: {
          sourceWorkbook: 'CFT_Pricing_Final.xlsx',
          zoneCode,
          lastSyncedAt: new Date().toISOString(),
        },
        updated_at: new Date(),
      })
      .where(eq(zones.id, zoneId))
  }

  return zoneIdByCode
}

const assertSafeToReplaceMappings = async () => {
  const [pincodeCountRows, orderCountRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(b2bPincodes),
    db.execute(sql`select count(*)::int as count from b2b_orders`),
  ])

  const existingPincodeCount = Number(pincodeCountRows[0]?.count || 0)
  const existingOrderCount = Number((orderCountRows.rows[0] as any)?.count || 0)

  if (existingPincodeCount > 0 && existingOrderCount > 0) {
    throw new Error(
      `Refusing to replace ${existingPincodeCount} B2B pincode mappings because ${existingOrderCount} B2B orders already exist.`,
    )
  }
}

const insertInChunks = async <T>(rows: T[], insertChunk: (chunk: T[]) => Promise<void>) => {
  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    await insertChunk(rows.slice(index, index + INSERT_CHUNK_SIZE))
  }
}

async function syncCftB2BZoneMapping() {
  const workbookPath = ensureWorkbookPath()
  const { pricingRows, pincodeRows } = parseWorkbook(workbookPath)
  validateWorkbookOverrides(pricingRows)

  const mappedPincodes = buildPincodeRecords(pincodeRows)
  const zoneIdByCode = await ensureRequiredZones()
  await assertSafeToReplaceMappings()

  const zoneIds = Array.from(zoneIdByCode.values())
  const stateRows = Object.entries(ZONE_DETAILS).flatMap(([zoneCode, details]) =>
    details.states.map((stateName) => ({
      zone_id: zoneIdByCode.get(zoneCode as ZoneCode)!,
      state_name: stateName,
      courier_id: null,
      service_provider: null,
      created_at: new Date(),
      updated_at: new Date(),
    })),
  )

  await db.transaction(async (tx) => {
    await tx.delete(b2bZoneStates).where(inArray(b2bZoneStates.zone_id, zoneIds))
    await tx.delete(b2bPincodes).where(inArray(b2bPincodes.zone_id, zoneIds))

    await insertInChunks(stateRows, async (chunk) => {
      await tx.insert(b2bZoneStates).values(chunk)
    })

    await insertInChunks(mappedPincodes, async (chunk) => {
      await tx.insert(b2bPincodes).values(
        chunk.map((row) => ({
          pincode: row.pincode,
          city: row.city,
          state: row.state,
          zone_id: zoneIdByCode.get(row.zoneCode)!,
          courier_id: null,
          service_provider: null,
          is_oda: row.isOda,
          is_remote: false,
          is_mall: false,
          is_sez: false,
          is_airport: false,
          is_high_security: false,
          is_csd: false,
          metadata: {
            sourceWorkbook: 'CFT_Pricing_Final.xlsx',
            dispatchCenter: row.dispatchCenter,
            originCenter: row.originCenter,
            returnCenter: row.returnCenter,
            mappingBasis: row.mappingBasis,
          },
          created_at: new Date(),
          updated_at: new Date(),
        })),
      )
    })
  })

  const [syncedStateCountRows, syncedPincodeCountRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(b2bZoneStates),
    db.select({ count: sql<number>`count(*)::int` }).from(b2bPincodes),
  ])

  console.log(
    JSON.stringify(
      {
        workbookPath,
        zones: REQUIRED_ZONE_CODES,
        syncedStateCount: syncedStateCountRows[0]?.count ?? 0,
        syncedPincodeCount: syncedPincodeCountRows[0]?.count ?? 0,
        cityOverrides: CITY_OVERRIDES,
      },
      null,
      2,
    ),
  )
}

syncCftB2BZoneMapping()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (error: any) => {
    console.error('Failed to sync CFT B2B zone mapping:', error?.message || error)
    console.error(error)
    await pool.end()
    process.exit(1)
  })
