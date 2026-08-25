import 'dotenv/config'
import { randomUUID } from 'crypto'
import { Client } from 'pg'

const XLSX = require('xlsx') as typeof import('xlsx')

type Row = Array<string | number | null | undefined>

type ChargeRow = {
  code: string
  remark: string
  calculation: string
  unitCharge: string | number | null
  min: string | number | null
  max: string | number | null
}

type ChargeConfig = {
  enabled: boolean
  type: string
  amount?: number
  rate?: number
  percent?: number
  minCharge?: number
  maxCharge?: number | null
  method?: string
  option?: string
  appliesTo?: string
  sourceCode?: string
  remark?: string
}

const getArg = (name: string, fallback = '') => {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')

const normalizeKey = (value: unknown) => normalize(value).toLowerCase()

const asNumber = (value: unknown, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const nullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const chargeType = (calculation: unknown) => {
  const value = normalizeKey(calculation)
  if (['%age', 'percent', 'percentage'].includes(value)) return 'percent'
  if (['per kg', 'base_kg', 'base kg'].includes(value)) return value === 'base kg' ? 'base_kg' : value
  if (['lr', 'per lr', 'pur', 'per pur'].includes(value)) return 'flat'
  return value || 'flat'
}

const durationFromValue = (value: unknown) => {
  const parsed = asNumber(value, 1)
  if (parsed === 2) return 'previous_billing_month'
  if (parsed === 3) return 'first_day_current_month'
  return 'current_billing_month'
}

const chargeConfigFromRow = (
  row: ChargeRow | undefined,
  fallbackType = 'flat',
  options: Partial<ChargeConfig> = {},
): ChargeConfig => {
  const amount = asNumber(row?.unitCharge, 0)
  const minCharge = nullableNumber(row?.min)
  const maxCharge = nullableNumber(row?.max)
  const type = row ? chargeType(row.calculation) : fallbackType
  const enabled = amount > 0 || Number(minCharge || 0) > 0
  const config: ChargeConfig = {
    enabled,
    type: type || fallbackType,
    sourceCode: row?.code,
    remark: row?.remark,
    ...options,
  }
  if (config.type === 'percent') {
    config.percent = amount
  } else {
    config.amount = amount
    config.rate = amount
  }
  if (minCharge !== null) config.minCharge = minCharge
  if (maxCharge !== null) config.maxCharge = maxCharge
  return config
}

const modeFromOdaValue = (value: unknown) => {
  const parsed = asNumber(value, 1)
  if (parsed === 2) return 'pickup'
  if (parsed === 3) return 'both'
  return 'delivery'
}

const boolFromYesNo = (value: unknown) => normalizeKey(value) === 'yes'

const parseWorkbook = (workbookPath: string) => {
  const workbook = XLSX.readFile(workbookPath, { cellDates: false })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Workbook has no sheets')
  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  })

  const chargeHeaderIndex = rows.findIndex((row) => normalizeKey(row[0]) === 'charge')
  const odaHeaderIndex = rows.findIndex((row) => normalizeKey(row[0]) === 'oda charges')
  const specialHeaderIndex = rows.findIndex((row) => normalizeKey(row[0]) === 'source')
  if (chargeHeaderIndex < 0 || odaHeaderIndex < 0 || specialHeaderIndex < 0) {
    throw new Error('Could not find required charge, ODA, or destination sections in workbook')
  }

  const chargeRows = new Map<string, ChargeRow>()
  const chargeRowsList: ChargeRow[] = []
  for (let index = chargeHeaderIndex + 1; index < odaHeaderIndex; index += 1) {
    const row = rows[index] || []
    const code = normalize(row[0])
    if (!code) continue
    const parsedChargeRow = {
      code,
      remark: normalize(row[1]),
      calculation: normalize(row[2]),
      unitCharge: row[3] ?? null,
      min: row[4] ?? null,
      max: row[5] ?? null,
    }
    chargeRowsList.push(parsedChargeRow)
    if (!chargeRows.has(normalizeKey(code))) chargeRows.set(normalizeKey(code), parsedChargeRow)
  }

  const getCharge = (code: string) => chargeRows.get(normalizeKey(code))

  const handlingSlabs = chargeRowsList
    .filter((row) => normalizeKey(row.code) === 'handling')
    .map((row) => {
      const match = normalize(row.calculation).match(/^(>=)?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/)
      const lowerKg = match ? asNumber(match[2], 0) : 0
      const upperKg = match?.[3] ? asNumber(match[3], 0) : null
      return {
        lowerKg,
        upperKg,
        charge: asNumber(row.unitCharge, 0),
        chargeType: 'per_kg',
      }
    })

  const odaSlabs = []
  for (let index = odaHeaderIndex + 1; index < specialHeaderIndex; index += 1) {
    const row = rows[index] || []
    if (normalizeKey(row[0]) !== 'oda') continue
    odaSlabs.push({
      lowerKg: asNumber(row[1], 0),
      upperKg: nullableNumber(row[2]),
      perKg: asNumber(row[3], 0),
      minCharge: asNumber(row[4], 0),
      maxCharge: nullableNumber(row[5]),
    })
  }

  const specialDestinationRates = []
  for (let index = specialHeaderIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || []
    const originZone = normalize(row[0])
    const destination = normalize(row[1])
    const ratePerKg = nullableNumber(row[2])
    if (!originZone || !destination || ratePerKg === null) continue
    specialDestinationRates.push({
      originZone,
      destination,
      ratePerKg,
      originType: normalize(row[3]) || 'Zone',
      originIds: normalize(row[4]),
      destinationIds: normalize(row[5]),
      destinationType: normalize(row[6]).toLowerCase() || 'state',
      startKg: nullableNumber(row[7]),
      endKg: nullableNumber(row[8]),
    })
  }

  const fuelLocationIds = normalize(getCharge('Fuel Hike Location')?.unitCharge)
    .split(/[,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const cityIdMap: Record<string, string | number> = {}
  for (const row of rows) {
    const city = normalize(row[10])
    const id = row[11]
    if (city && id !== null && id !== undefined && id !== '') cityIdMap[city] = id as string | number
  }
  const locationNames = Object.entries(cityIdMap)
    .filter(([, id]) => fuelLocationIds.includes(String(id)))
    .map(([city]) => city)

  const fsc = getCharge('fsc')
  const demurrage = getCharge('demurrage_charge')
  const minWeight = getCharge('min_chg_wt')
  const minLrCharge = getCharge('min_lr_charge')
  const odaMode = getCharge('ODA Pincode')
  const pickupOdaList = getCharge('pickup_oda_list')
  const deliveryOdaList = getCharge('dlv_oda_list')
  const maxDeadWeight = getCharge('max_dead_wt')

  const serviceChargesConfig = {
    rovOwner: chargeConfigFromRow(getCharge('rov_owner'), 'percent', {
      method: 'whichever_is_higher',
      appliesTo: 'invoice',
    }),
    rovCarrier: chargeConfigFromRow(getCharge('rov_carrier'), 'percent', {
      method: 'whichever_is_higher',
      appliesTo: 'invoice',
    }),
    floorDelivery: chargeConfigFromRow(getCharge('floor_delivery'), 'per_kg'),
    mallDelivery: chargeConfigFromRow(getCharge('mall_delivery'), 'flat'),
    csdDelivery: chargeConfigFromRow(getCharge('csd_army_delivery'), 'per_kg'),
    deliveryReattempt: chargeConfigFromRow(getCharge('re_attempt_charge'), 'per_kg'),
    fmCost: chargeConfigFromRow(getCharge('fm_cost'), 'per_kg'),
    lmCost: chargeConfigFromRow(getCharge('lm_cost'), 'per_kg'),
    toPay: chargeConfigFromRow(getCharge('to_pay'), 'flat'),
    chequeHandling: chargeConfigFromRow(getCharge('cheque_handling'), 'flat'),
    cashHandling: chargeConfigFromRow(getCharge('cash_handling'), 'percent', {
      appliesTo: 'invoice',
    }),
    appointmentHandling: chargeConfigFromRow(getCharge('apt_handling'), 'base_kg'),
    greenTax: chargeConfigFromRow(getCharge('green_tax'), 'base_kg'),
    podCharges: {
      ...chargeConfigFromRow(getCharge('pod_charges'), 'flat'),
      option: normalize(getCharge('pod_charges_options')?.unitCharge) || 'pod_link',
    },
    sunHolidayDelivery: chargeConfigFromRow(getCharge('sun_hol_delivery'), 'flat'),
    reattemptFreeAttempts: asNumber(getCharge('re_attempt_free_attempts')?.unitCharge, 0),
    intraCityRate: asNumber(getCharge('intra_city_rate')?.unitCharge, 0),
    minLrCharge: chargeConfigFromRow(getCharge('min_lr_charge'), 'flat'),
    specialDestinationRates,
  }

  const fuelHikeConfig = {
    baseRate: asNumber(getCharge('Fuel Base Rate')?.unitCharge, 0),
    currentRate: asNumber(getCharge('Fuel Base Rate')?.unitCharge, 0),
    threshold: asNumber(getCharge('Fuel Hike Threshold')?.unitCharge, 0),
    thresholdType: chargeType(getCharge('Fuel Hike Threshold')?.calculation) === 'percent' ? 'percent' : 'amount',
    duration: durationFromValue(getCharge('Fuel Hike Duration')?.unitCharge),
    changeInFuelRate: asNumber(getCharge('Change in Fuel Rate')?.unitCharge, 0),
    changeInFreight: asNumber(getCharge('Change in Freight')?.unitCharge, 0),
    changeInFreightType:
      chargeType(getCharge('Change in Freight')?.calculation) === 'percent' ? 'percent' : 'amount_per_kg',
    locationIds: fuelLocationIds,
    locationNames,
    application:
      asNumber(getCharge('Fuel Hike Application')?.unitCharge, 1) === 2
        ? 'base_freight_plus_oda'
        : 'base_freight',
    allowNegative: asNumber(getCharge('Fuel Hike Logic')?.unitCharge, 1) === 2,
  }

  const billingConfig = {
    invoiceType: normalize(getCharge('Invoice Type')?.unitCharge).toLowerCase() || 'delivery',
    billingCycle: normalize(getCharge('Billing Cycle')?.unitCharge).toLowerCase() || 'monthly',
    billingStartDate: asNumber(getCharge('billing_start_date')?.unitCharge, 1),
    roundOff: boolFromYesNo(getCharge('Round-off')?.unitCharge),
    weightSlabBasedBilling: normalize(getCharge('Weight slab based billing')?.unitCharge) || 'No',
    maxDeadWeightPerPackage: asNumber(maxDeadWeight?.unitCharge, 0),
    weightRule: normalize(getCharge('Weight Rule')?.unitCharge) || 'max_dead_vol_wt',
  }

  return {
    additionalCharges: {
      awb_charges: asNumber(getCharge('processing')?.unitCharge, 0),
      cft_factor: asNumber(getCharge('divisor')?.unitCharge, 4500),
      minimum_chargeable_amount: asNumber(minLrCharge?.unitCharge, 0),
      minimum_chargeable_weight: asNumber(minWeight?.unitCharge, 0),
      minimum_chargeable_method: 'whichever_is_higher',
      free_storage_days: asNumber(getCharge('demurrage_free_store_period')?.unitCharge, 0),
      demurrage_per_awb_day: asNumber(demurrage?.min, 0),
      demurrage_per_kg_day: asNumber(demurrage?.unitCharge, 0),
      demurrage_method: 'whichever_is_higher',
      public_holiday_pickup_charge: 0,
      fuel_surcharge_percentage: asNumber(fsc?.unitCharge, 0),
      green_tax: 0,
      oda_config: {
        mode: modeFromOdaValue(odaMode?.unitCharge),
        pickupExemptions: normalize(pickupOdaList?.unitCharge)
          .split(/[,\n\r]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        deliveryExemptions: normalize(deliveryOdaList?.unitCharge)
          .split(/[,\n\r]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        slabs: odaSlabs,
      },
      handling_slabs: handlingSlabs,
      fuel_hike_config: fuelHikeConfig,
      service_charges_config: serviceChargesConfig,
      billing_config: billingConfig,
      oda_charges: 0,
      oda_per_kg_charge: 0,
      oda_method: 'whichever_is_higher',
      csd_delivery_charge: 0,
      time_specific_per_kg: 0,
      time_specific_per_awb: 0,
      time_specific_method: 'whichever_is_higher',
      mall_delivery_per_kg: 0,
      mall_delivery_per_awb: 0,
      mall_delivery_method: 'whichever_is_higher',
      delivery_reattempt_per_kg: 0,
      delivery_reattempt_per_awb: 0,
      delivery_reattempt_method: 'whichever_is_higher',
      handling_single_piece: 0,
      handling_below_100_kg: 0,
      handling_100_to_200_kg: 0,
      handling_above_200_kg: 0,
      insurance_charge: 0,
      cod_fixed_amount: 0,
      cod_percentage: 0,
      cod_method: 'whichever_is_higher',
      rov_fixed_amount: 0,
      rov_percentage: 0,
      rov_method: 'whichever_is_higher',
      liability_limit: 0,
      liability_method: 'whichever_is_lower',
      custom_fields: {},
      field_definitions: {},
      metadata: {
        sourceWorkbook: workbookPath.split(/[\\/]/).pop(),
        sourceSheet: firstSheetName,
        importedAt: new Date().toISOString(),
        chargeRows: chargeRowsList,
      },
    },
    counts: {
      chargeRows: chargeRowsList.length,
      odaSlabs: odaSlabs.length,
      handlingSlabs: handlingSlabs.length,
      specialDestinationRates: specialDestinationRates.length,
    },
  }
}

const main = async () => {
  const workbookPath = getArg('workbook') || process.env.CFT_WORKBOOK_PATH
  const courierIdArg = getArg('courier-id')
  const courierName = getArg('courier-name', 'Delhivery - Household')
  const planIdArg = getArg('plan-id')
  const planName = getArg('plan-name', 'Basic')
  const serviceProvider = getArg('service-provider', 'delhivery')
  const dryRun = process.argv.includes('--dry-run')

  if (!workbookPath) {
    throw new Error('Pass --workbook=/path/to/CFT.xlsx or set CFT_WORKBOOK_PATH')
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')

  const parsed = parseWorkbook(workbookPath)
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    const courierResult = courierIdArg
      ? await client.query<{ id: number; name: string }>(
          'select id, name from couriers where id = $1 limit 1',
          [Number(courierIdArg)],
        )
      : await client.query<{ id: number; name: string }>(
          'select id, name from couriers where lower(name) = lower($1) limit 1',
          [courierName],
        )
    const courier = courierResult.rows[0]
    if (!courier) throw new Error(`Courier not found: ${courierName}`)

    const planResult = planIdArg
      ? await client.query<{ id: string; name: string }>(
          'select id, name from plans where id = $1 limit 1',
          [planIdArg],
        )
      : await client.query<{ id: string; name: string }>(
          'select id, name from plans where lower(name) = lower($1) limit 1',
          [planName],
        )
    const plan = planResult.rows[0]
    if (!plan) throw new Error(`Plan not found: ${planName}`)

    const data = parsed.additionalCharges
    const summary = {
      courier,
      plan,
      serviceProvider,
      dryRun,
      counts: parsed.counts,
      keyValues: {
        processingLrCharge: data.awb_charges,
        fscPercent: data.fuel_surcharge_percentage,
        cftDivisor: data.cft_factor,
        minimumChargedWeightKg: data.minimum_chargeable_weight,
        minimumLrCharge: data.minimum_chargeable_amount,
        odaMode: data.oda_config.mode,
        odaSlabs: data.oda_config.slabs,
        specialDestinationRates: data.service_charges_config.specialDestinationRates.length,
      },
    }

    if (dryRun) {
      console.log(JSON.stringify(summary, null, 2))
      return
    }

    const existing = await client.query<{ id: string }>(
      `select id from shiplifi_b2b_additional_charges
       where courier_id = $1 and service_provider = $2 and plan_id = $3
       limit 1`,
      [courier.id, serviceProvider, plan.id],
    )

    const values = [
      data.awb_charges,
      data.cft_factor,
      data.minimum_chargeable_amount,
      data.minimum_chargeable_weight,
      data.minimum_chargeable_method,
      data.free_storage_days,
      data.demurrage_per_awb_day,
      data.demurrage_per_kg_day,
      data.demurrage_method,
      data.public_holiday_pickup_charge,
      data.fuel_surcharge_percentage,
      data.green_tax,
      JSON.stringify(data.oda_config),
      JSON.stringify(data.handling_slabs),
      JSON.stringify(data.fuel_hike_config),
      JSON.stringify(data.service_charges_config),
      JSON.stringify(data.billing_config),
      data.oda_charges,
      data.oda_per_kg_charge,
      data.oda_method,
      data.csd_delivery_charge,
      data.time_specific_per_kg,
      data.time_specific_per_awb,
      data.time_specific_method,
      data.mall_delivery_per_kg,
      data.mall_delivery_per_awb,
      data.mall_delivery_method,
      data.delivery_reattempt_per_kg,
      data.delivery_reattempt_per_awb,
      data.delivery_reattempt_method,
      data.handling_single_piece,
      data.handling_below_100_kg,
      data.handling_100_to_200_kg,
      data.handling_above_200_kg,
      data.insurance_charge,
      data.cod_fixed_amount,
      data.cod_percentage,
      data.cod_method,
      data.rov_fixed_amount,
      data.rov_percentage,
      data.rov_method,
      data.liability_limit,
      data.liability_method,
      JSON.stringify(data.custom_fields),
      JSON.stringify(data.field_definitions),
      JSON.stringify(data.metadata),
    ]

    if (existing.rows[0]) {
      await client.query(
        `update shiplifi_b2b_additional_charges set
          awb_charges=$1, cft_factor=$2, minimum_chargeable_amount=$3,
          minimum_chargeable_weight=$4, minimum_chargeable_method=$5,
          free_storage_days=$6, demurrage_per_awb_day=$7, demurrage_per_kg_day=$8,
          demurrage_method=$9, public_holiday_pickup_charge=$10,
          fuel_surcharge_percentage=$11, green_tax=$12, oda_config=$13::jsonb,
          handling_slabs=$14::jsonb, fuel_hike_config=$15::jsonb,
          service_charges_config=$16::jsonb, billing_config=$17::jsonb,
          oda_charges=$18, oda_per_kg_charge=$19, oda_method=$20,
          csd_delivery_charge=$21, time_specific_per_kg=$22, time_specific_per_awb=$23,
          time_specific_method=$24, mall_delivery_per_kg=$25, mall_delivery_per_awb=$26,
          mall_delivery_method=$27, delivery_reattempt_per_kg=$28,
          delivery_reattempt_per_awb=$29, delivery_reattempt_method=$30,
          handling_single_piece=$31, handling_below_100_kg=$32,
          handling_100_to_200_kg=$33, handling_above_200_kg=$34,
          insurance_charge=$35, cod_fixed_amount=$36, cod_percentage=$37,
          cod_method=$38, rov_fixed_amount=$39, rov_percentage=$40, rov_method=$41,
          liability_limit=$42, liability_method=$43, custom_fields=$44::jsonb,
          field_definitions=$45::jsonb, metadata=$46::jsonb, updated_at=now()
         where id=$47`,
        [...values, existing.rows[0].id],
      )
    } else {
      await client.query(
        `insert into shiplifi_b2b_additional_charges (
          id, plan_id, courier_id, service_provider, awb_charges, cft_factor,
          minimum_chargeable_amount, minimum_chargeable_weight, minimum_chargeable_method,
          free_storage_days, demurrage_per_awb_day, demurrage_per_kg_day,
          demurrage_method, public_holiday_pickup_charge, fuel_surcharge_percentage,
          green_tax, oda_config, handling_slabs, fuel_hike_config, service_charges_config,
          billing_config, oda_charges, oda_per_kg_charge, oda_method, csd_delivery_charge,
          time_specific_per_kg, time_specific_per_awb, time_specific_method,
          mall_delivery_per_kg, mall_delivery_per_awb, mall_delivery_method,
          delivery_reattempt_per_kg, delivery_reattempt_per_awb, delivery_reattempt_method,
          handling_single_piece, handling_below_100_kg, handling_100_to_200_kg,
          handling_above_200_kg, insurance_charge, cod_fixed_amount, cod_percentage,
          cod_method, rov_fixed_amount, rov_percentage, rov_method, liability_limit,
          liability_method, custom_fields, field_definitions, metadata, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb,
          $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
          $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47,
          $48::jsonb, $49::jsonb, $50::jsonb, now(), now()
        )`,
        [randomUUID(), plan.id, courier.id, serviceProvider, ...values],
      )
    }

    console.log(JSON.stringify({ ...summary, saved: true }, null, 2))
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
