import {
  Box,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  useColorModeValue,
} from '@chakra-ui/react'
import { memo } from 'react'

const toList = (value) =>
  String(value || '')
    .split(/[,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const listToText = (value) => (Array.isArray(value) ? value.join('\n') : '')

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatMaybe = (value) => (value === null || value === undefined ? '' : String(value))

const normalizeType = (value, fallback = 'flat') => value || fallback

const getChargeConfig = (config, key, defaults = {}) => ({ ...(defaults || {}), ...(config?.[key] || {}) })

const serializeSpecialRules = (rules = []) =>
  Array.isArray(rules)
    ? rules
        .map((rule) =>
          [
            rule.originZone || rule.origin_zone || '',
            rule.destinationType || rule.destination_type || 'state',
            rule.destination || '',
            rule.ratePerKg ?? rule.rate_per_kg ?? '',
            rule.startKg ?? rule.start_kg ?? '',
            rule.endKg ?? rule.end_kg ?? '',
          ].join(','),
        )
        .join('\n')
    : ''

const parseSpecialRules = (text) =>
  String(text || '')
    .split(/[\n\r]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [originZone, destinationType, destination, ratePerKg, startKg, endKg] = line
        .split(',')
        .map((item) => item.trim())
      return {
        originZone,
        destinationType: (destinationType || 'state').toLowerCase(),
        destination,
        ratePerKg: parseNumber(ratePerKg),
        startKg: startKg === '' ? null : parseNumber(startKg),
        endKg: endKg === '' ? null : parseNumber(endKg),
      }
    })
    .filter((rule) => rule.originZone && rule.destination && rule.ratePerKg > 0)

const NumberField = ({ label, helper, value, onChange, precision = 2 }) => (
  <FormControl>
    <FormLabel fontSize="xs" fontWeight="medium">
      {label}
    </FormLabel>
    <NumberInput
      size="sm"
      step={precision === 0 ? 1 : 0.01}
      precision={precision}
      value={value ?? ''}
      onChange={(next) => onChange(next || '')}
    >
      <NumberInputField inputMode="decimal" />
    </NumberInput>
    {helper && <FormHelperText fontSize="xs">{helper}</FormHelperText>}
  </FormControl>
)

const SelectField = ({ label, helper, value, onChange, children }) => (
  <FormControl>
    <FormLabel fontSize="xs" fontWeight="medium">
      {label}
    </FormLabel>
    <Select size="sm" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
      {children}
    </Select>
    {helper && <FormHelperText fontSize="xs">{helper}</FormHelperText>}
  </FormControl>
)

const ConfigChargeCard = ({ title, remark, config, onChange, defaultType = 'flat', showPercent = false }) => {
  const type = normalizeType(config.type || config.calculation, defaultType)
  const valueLabel = ['percent', '%age', 'percentage'].includes(type) ? 'Percentage (%)' : 'Unit Charge (Rs.)'

  return (
    <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.200" bg="white">
      <Text fontSize="sm" fontWeight="semibold" mb={1}>
        {title}
      </Text>
      {remark && (
        <Text fontSize="xs" color="gray.600" mb={3}>
          {remark}
        </Text>
      )}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3}>
        <FormControl>
          <FormLabel fontSize="xs">Enabled</FormLabel>
          <Checkbox
            isChecked={config.enabled !== false}
            onChange={(event) => onChange({ enabled: event.target.checked })}
          >
            Active
          </Checkbox>
        </FormControl>
        <SelectField label="Calculation" value={type} onChange={(value) => onChange({ type: value })}>
          <option value="flat">LR / flat</option>
          <option value="per_kg">Per kg</option>
          <option value="base_kg">Base kg</option>
          <option value="percent">%age</option>
        </SelectField>
        <NumberField
          label={valueLabel}
          value={config.amount ?? config.rate ?? config.percent ?? ''}
          onChange={(value) =>
            onChange(
              ['percent', '%age', 'percentage'].includes(type)
                ? { percent: value, amount: undefined, rate: undefined }
                : { rate: value, amount: value, percent: undefined },
            )
          }
        />
        <NumberField
          label="Minimum (Rs.)"
          value={config.minCharge ?? config.min ?? ''}
          onChange={(value) => onChange({ minCharge: value })}
        />
      </SimpleGrid>
      {showPercent && (
        <FormHelperText fontSize="xs">
          Percent charges use invoice/COD amount when the calculation logic requires it.
        </FormHelperText>
      )}
    </Box>
  )
}

const CFTAdvancedConfigSection = memo(({ formData, onFieldChange }) => {
  const cardBg = useColorModeValue('cyan.50', 'cyan.900')
  const cardBorder = useColorModeValue('cyan.200', 'cyan.700')
  const odaConfig = formData.odaConfig || {}
  const fuelHikeConfig = formData.fuelHikeConfig || {}
  const serviceChargesConfig = formData.serviceChargesConfig || {}
  const billingConfig = formData.billingConfig || {}
  const handlingSlabs = Array.isArray(formData.handlingSlabs) ? formData.handlingSlabs : []
  const odaSlabs = Array.isArray(odaConfig.slabs) ? odaConfig.slabs : []

  const updateOda = (key, value) => onFieldChange('odaConfig', { ...odaConfig, [key]: value })
  const updateFuel = (key, value) =>
    onFieldChange('fuelHikeConfig', { ...fuelHikeConfig, [key]: value })
  const updateBilling = (key, value) =>
    onFieldChange('billingConfig', { ...billingConfig, [key]: value })
  const updateServiceCharge = (key, patch) => {
    const current = getChargeConfig(serviceChargesConfig, key)
    const next = { ...current, ...patch }
    Object.keys(next).forEach((itemKey) => next[itemKey] === undefined && delete next[itemKey])
    onFieldChange('serviceChargesConfig', { ...serviceChargesConfig, [key]: next })
  }
  const updateServiceValue = (key, value) =>
    onFieldChange('serviceChargesConfig', { ...serviceChargesConfig, [key]: value })

  const updateOdaSlab = (index, patch) => {
    const defaults = [
      { lowerKg: 0, upperKg: 200, perKg: 4, minCharge: 750, maxCharge: null },
      { lowerKg: 200, upperKg: null, perKg: 4, minCharge: 750, maxCharge: null },
    ]
    const next = [0, 1].map((itemIndex) => ({ ...defaults[itemIndex], ...(odaSlabs[itemIndex] || {}) }))
    next[index] = { ...next[index], ...patch }
    updateOda('slabs', next)
  }

  const updateHandlingSlab = (index, patch) => {
    const defaults = [
      { lowerKg: 100, upperKg: 250, charge: 0, chargeType: 'flat' },
      { lowerKg: 250, upperKg: 400, charge: 0, chargeType: 'flat' },
      { lowerKg: 400, upperKg: null, charge: 3, chargeType: 'per_kg' },
    ]
    const next = [0, 1, 2].map((itemIndex) => ({ ...defaults[itemIndex], ...(handlingSlabs[itemIndex] || {}) }))
    next[index] = { ...next[index], ...patch }
    onFieldChange('handlingSlabs', next)
  }

  return (
    <Box>
      <Text fontSize="md" fontWeight="bold" color="cyan.700" mb={4}>
        8. CFT Sheet Charge Setup
      </Text>

      <Box mb={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={1}>
          ODA pincode logic and ODA slabs
        </Text>
        <Text fontSize="xs" color="gray.600" mb={3}>
          Sheet remark: 1 = destination pincode, 2 = pickup pincode, 3 = pickup and destination pincode.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <SelectField label="ODA Apply Mode" value={odaConfig.mode || 'delivery'} onChange={(value) => updateOda('mode', value)}>
            <option value="delivery">1 - Delivery pincode only</option>
            <option value="pickup">2 - Pickup pincode only</option>
            <option value="both">3 - Pickup or delivery pincode</option>
          </SelectField>
          <FormControl>
            <FormLabel fontSize="xs">Pickup ODA Exemptions</FormLabel>
            <Textarea
              size="sm"
              rows={4}
              value={listToText(odaConfig.pickupExemptions)}
              onChange={(event) => updateOda('pickupExemptions', toList(event.target.value))}
            />
            <FormHelperText fontSize="xs">Sheet row pickup_oda_list. One pincode per line.</FormHelperText>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Delivery ODA Exemptions</FormLabel>
            <Textarea
              size="sm"
              rows={4}
              value={listToText(odaConfig.deliveryExemptions)}
              onChange={(event) => updateOda('deliveryExemptions', toList(event.target.value))}
            />
            <FormHelperText fontSize="xs">Sheet row dlv_oda_list. One pincode per line.</FormHelperText>
          </FormControl>
        </SimpleGrid>
        <SimpleGrid mt={4} columns={{ base: 1, md: 2 }} spacing={4}>
          {[0, 1].map((index) => {
            const slab = {
              ...(index === 0
                ? { lowerKg: 0, upperKg: 200, perKg: 4, minCharge: 750, maxCharge: null }
                : { lowerKg: 200, upperKg: null, perKg: 4, minCharge: 750, maxCharge: null }),
              ...(odaSlabs[index] || {}),
            }
            return (
              <Box key={`oda-slab-${index}`} p={3} borderWidth="1px" borderRadius="md" bg="white">
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  ODA slab {index + 1}
                </Text>
                <SimpleGrid columns={{ base: 1, md: 5 }} spacing={3}>
                  <NumberField label="Lower kg >=" value={formatMaybe(slab.lowerKg)} onChange={(value) => updateOdaSlab(index, { lowerKg: value })} />
                  <NumberField label="Upper kg <" value={formatMaybe(slab.upperKg)} onChange={(value) => updateOdaSlab(index, { upperKg: value === '' ? null : value })} />
                  <NumberField label="Per kg (Rs.)" value={formatMaybe(slab.perKg)} onChange={(value) => updateOdaSlab(index, { perKg: value })} />
                  <NumberField label="Min (Rs.)" value={formatMaybe(slab.minCharge)} onChange={(value) => updateOdaSlab(index, { minCharge: value })} />
                  <NumberField label="Max (Rs.)" value={formatMaybe(slab.maxCharge)} onChange={(value) => updateOdaSlab(index, { maxCharge: value === '' ? null : value })} />
                </SimpleGrid>
              </Box>
            )
          })}
        </SimpleGrid>
      </Box>

      <Box mb={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={1}>
          Handling slabs
        </Text>
        <Text fontSize="xs" color="gray.600" mb={3}>
          Sheet remark: Package Handling Charges by chargeable weight.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {[0, 1, 2].map((index) => {
            const slab = {
              ...(index === 0
                ? { lowerKg: 100, upperKg: 250, charge: 0, chargeType: 'flat' }
                : index === 1
                ? { lowerKg: 250, upperKg: 400, charge: 0, chargeType: 'flat' }
                : { lowerKg: 400, upperKg: null, charge: 3, chargeType: 'per_kg' }),
              ...(handlingSlabs[index] || {}),
            }
            return (
              <Box key={`handling-slab-${index}`} p={3} borderWidth="1px" borderRadius="md" bg="white">
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  Handling slab {index + 1}
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <NumberField label="Lower kg >=" value={formatMaybe(slab.lowerKg)} onChange={(value) => updateHandlingSlab(index, { lowerKg: value })} />
                  <NumberField label="Upper kg <" value={formatMaybe(slab.upperKg)} onChange={(value) => updateHandlingSlab(index, { upperKg: value === '' ? null : value })} />
                  <NumberField label="Charge" value={formatMaybe(slab.charge)} onChange={(value) => updateHandlingSlab(index, { charge: value })} />
                  <SelectField label="Calculation" value={slab.chargeType || 'flat'} onChange={(value) => updateHandlingSlab(index, { chargeType: value })}>
                    <option value="flat">LR / flat</option>
                    <option value="per_kg">Per kg</option>
                  </SelectField>
                </SimpleGrid>
              </Box>
            )
          })}
        </SimpleGrid>
      </Box>

      <Box mb={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={1}>
          Fuel hike / DPH
        </Text>
        <Text fontSize="xs" color="gray.600" mb={3}>
          Sheet remarks: base rate is contract fuel rate; threshold can be Rs/litre or %; freight changes for every fuel-rate step.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
          <NumberField label="Fuel Base Rate" value={fuelHikeConfig.baseRate ?? ''} onChange={(value) => updateFuel('baseRate', value)} />
          <NumberField label="Current Fuel Rate" value={fuelHikeConfig.currentRate ?? ''} onChange={(value) => updateFuel('currentRate', value)} />
          <NumberField label="Fuel Hike Threshold" value={fuelHikeConfig.threshold ?? ''} onChange={(value) => updateFuel('threshold', value)} />
          <SelectField label="Threshold Type" value={fuelHikeConfig.thresholdType || 'amount'} onChange={(value) => updateFuel('thresholdType', value)}>
            <option value="amount">Rs/litre</option>
            <option value="percent">Percent</option>
          </SelectField>
          <NumberField label="Change in Fuel Rate" value={fuelHikeConfig.changeInFuelRate ?? ''} onChange={(value) => updateFuel('changeInFuelRate', value)} />
          <NumberField label="Change in Freight" value={fuelHikeConfig.changeInFreight ?? ''} onChange={(value) => updateFuel('changeInFreight', value)} />
          <SelectField label="Freight Change Type" value={fuelHikeConfig.changeInFreightType || 'percent'} onChange={(value) => updateFuel('changeInFreightType', value)}>
            <option value="percent">%age</option>
            <option value="amount_per_kg">Rs/kg</option>
          </SelectField>
          <SelectField label="Fuel Hike Duration" value={fuelHikeConfig.duration || '1'} onChange={(value) => updateFuel('duration', value)}>
            <option value="1">1 - Current billing month</option>
            <option value="2">2 - Previous billing month</option>
            <option value="3">3 - 1st day of current billing month</option>
          </SelectField>
          <SelectField label="Fuel Hike Application" value={fuelHikeConfig.application || 'base_freight'} onChange={(value) => updateFuel('application', value)}>
            <option value="base_freight">1 - Base freight only</option>
            <option value="base_freight_plus_oda">2 - ODA + base freight</option>
          </SelectField>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={3}>
          <FormControl>
            <FormLabel fontSize="xs">Fuel Hike Location IDs</FormLabel>
            <Textarea
              size="sm"
              rows={2}
              value={Array.isArray(fuelHikeConfig.locationIds) ? fuelHikeConfig.locationIds.join(',') : fuelHikeConfig.locationIds || ''}
              onChange={(event) => updateFuel('locationIds', toList(event.target.value))}
            />
            <FormHelperText fontSize="xs">Sheet row Fuel Hike Location, e.g. 1,2,3,4.</FormHelperText>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Fuel Hike Location Names</FormLabel>
            <Textarea
              size="sm"
              rows={2}
              value={Array.isArray(fuelHikeConfig.locationNames) ? fuelHikeConfig.locationNames.join(',') : fuelHikeConfig.locationNames || ''}
              onChange={(event) => updateFuel('locationNames', toList(event.target.value))}
            />
            <FormHelperText fontSize="xs">Use names like Mumbai, Chennai, Delhi, Kolkata for matching.</FormHelperText>
          </FormControl>
        </SimpleGrid>
        <Checkbox
          mt={3}
          isChecked={Boolean(fuelHikeConfig.allowNegative)}
          onChange={(event) => updateFuel('allowNegative', event.target.checked)}
        >
          Fuel Hike Logic 2 - allow negative DPH if fuel falls below base rate
        </Checkbox>
      </Box>

      <Box mb={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={3}>
          Sheet charge rows 41, 42, 51-62, 65-67
        </Text>
        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
          <ConfigChargeCard title="floor_delivery" remark="Per kg or Min. per LR - whichever is higher" config={getChargeConfig(serviceChargesConfig, 'floorDelivery', { enabled: false, type: 'per_kg' })} onChange={(patch) => updateServiceCharge('floorDelivery', patch)} defaultType="per_kg" />
          <ConfigChargeCard title="mall_delivery" remark="Mall Delivery Charges" config={getChargeConfig(serviceChargesConfig, 'mallDelivery', { enabled: true, type: 'flat' })} onChange={(patch) => updateServiceCharge('mallDelivery', patch)} />
          <ConfigChargeCard title="csd_army_delivery" remark="CSD / Army Delivery Charges" config={getChargeConfig(serviceChargesConfig, 'csdDelivery', { enabled: true, type: 'per_kg' })} onChange={(patch) => updateServiceCharge('csdDelivery', patch)} defaultType="per_kg" />
          <ConfigChargeCard title="re_attempt_charge" remark="Per kg or per LR. Applies after configured free attempts." config={getChargeConfig(serviceChargesConfig, 'deliveryReattempt', { enabled: false, type: 'per_kg' })} onChange={(patch) => updateServiceCharge('deliveryReattempt', patch)} defaultType="per_kg" />
          <ConfigChargeCard title="sun_hol_delivery" remark="Sunday/public holiday delivery charge" config={getChargeConfig(serviceChargesConfig, 'sunHolidayDelivery', { enabled: false, type: 'flat' })} onChange={(patch) => updateServiceCharge('sunHolidayDelivery', patch)} />
          <ConfigChargeCard title="fm_cost" remark="For coloaders: Max(per kg x weight, Min. price per LR)" config={getChargeConfig(serviceChargesConfig, 'fmCost', { enabled: false, type: 'per_kg' })} onChange={(patch) => updateServiceCharge('fmCost', patch)} defaultType="per_kg" />
          <ConfigChargeCard title="lm_cost" remark="For coloaders: Max(per kg x weight, Min. price per LR)" config={getChargeConfig(serviceChargesConfig, 'lmCost', { enabled: false, type: 'per_kg' })} onChange={(patch) => updateServiceCharge('lmCost', patch)} defaultType="per_kg" />
          <ConfigChargeCard title="to_pay" remark="Per LR charge for to_pay shipment" config={getChargeConfig(serviceChargesConfig, 'toPay', { enabled: false, type: 'flat' })} onChange={(patch) => updateServiceCharge('toPay', patch)} />
          <ConfigChargeCard title="cheque_handling" remark="Per LR charge for cheque_handling" config={getChargeConfig(serviceChargesConfig, 'chequeHandling', { enabled: false, type: 'flat' })} onChange={(patch) => updateServiceCharge('chequeHandling', patch)} />
          <ConfigChargeCard title="cash_handling" remark="Max(%age of COD, Min. charge per LR)" config={getChargeConfig(serviceChargesConfig, 'cashHandling', { enabled: false, type: 'percent' })} onChange={(patch) => updateServiceCharge('cashHandling', patch)} defaultType="percent" showPercent />
          <ConfigChargeCard title="apt_handling" remark="Per kg charge for appointment deliveries" config={getChargeConfig(serviceChargesConfig, 'appointmentHandling', { enabled: false, type: 'base_kg' })} onChange={(patch) => updateServiceCharge('appointmentHandling', patch)} defaultType="base_kg" />
          <ConfigChargeCard title="green_tax" remark="Base kg green tax with minimum charge" config={getChargeConfig(serviceChargesConfig, 'greenTax', { enabled: false, type: 'base_kg' })} onChange={(patch) => updateServiceCharge('greenTax', patch)} defaultType="base_kg" />
          <ConfigChargeCard title="pod_charges" remark="Charge for sharing POD" config={getChargeConfig(serviceChargesConfig, 'podCharges', { enabled: false, type: 'flat' })} onChange={(patch) => updateServiceCharge('podCharges', patch)} />
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mt={4}>
          <SelectField label="POD Charges Option" value={serviceChargesConfig.podCharges?.option || 'pod_link'} onChange={(value) => updateServiceCharge('podCharges', { option: value })}>
            <option value="pod_hard">pod_hard</option>
            <option value="pod_cd">pod_cd</option>
            <option value="pod_link">pod_link</option>
          </SelectField>
          <NumberField label="Re-attempt Free Attempts" precision={0} value={serviceChargesConfig.reattemptFreeAttempts ?? ''} onChange={(value) => updateServiceValue('reattemptFreeAttempts', value)} />
          <NumberField label="Intra-city Rate per kg" value={serviceChargesConfig.intraCityRate ?? ''} onChange={(value) => updateServiceValue('intraCityRate', value)} helper="Used when origin and destination city match." />
        </SimpleGrid>
      </Box>

      <Box mb={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={3}>
          ROV owner / carrier risk from Sheet
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <ConfigChargeCard title="rov_owner" remark="Risk as %age of DCN and minimum price per LR. Keep zero if carrier risk is used." config={getChargeConfig(serviceChargesConfig, 'rovOwner', { enabled: true, type: 'percent' })} onChange={(patch) => updateServiceCharge('rovOwner', patch)} defaultType="percent" showPercent />
          <ConfigChargeCard title="rov_carrier" remark="Risk as %age of DCN and minimum price per LR. Keep zero if owner risk is used." config={getChargeConfig(serviceChargesConfig, 'rovCarrier', { enabled: true, type: 'percent' })} onChange={(patch) => updateServiceCharge('rovCarrier', patch)} defaultType="percent" showPercent />
        </SimpleGrid>
      </Box>

      <Box mb={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={1}>
          Special destination add-on rates
        </Text>
        <Text fontSize="xs" color="gray.600" mb={3}>
          Sheet rows 100 onward. One line per rule: origin zone, destination type, destination name, rate per kg, start kg, end kg. Example: N1,state,Himachal Pradesh,10.2,,
        </Text>
        <Textarea
          size="sm"
          rows={8}
          fontFamily="mono"
          value={serializeSpecialRules(serviceChargesConfig.specialDestinationRates)}
          onChange={(event) =>
            updateServiceValue('specialDestinationRates', parseSpecialRules(event.target.value))
          }
        />
      </Box>

      <Box mt={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={3}>
          Billing Rules
        </Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <SelectField label="Invoice Type" value={billingConfig.invoiceType || 'delivery'} onChange={(value) => updateBilling('invoiceType', value)}>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </SelectField>
          <SelectField label="Billing Cycle" value={billingConfig.billingCycle || 'monthly'} onChange={(value) => updateBilling('billingCycle', value)}>
            <option value="weekly">Weekly</option>
            <option value="bi-monthly">Bi-monthly</option>
            <option value="monthly">Monthly</option>
          </SelectField>
          <NumberField label="Billing Start Date" precision={0} value={billingConfig.billingStartDate ?? ''} onChange={(value) => updateBilling('billingStartDate', value)} />
          <NumberField label="Max Dead Weight / Package" value={billingConfig.maxDeadWeightPerPackage ?? ''} onChange={(value) => updateBilling('maxDeadWeightPerPackage', value)} />
          <SelectField label="Weight Rule" value={billingConfig.weightRule || 'max_dead_vol_wt'} onChange={(value) => updateBilling('weightRule', value)}>
            <option value="max_dead_vol_wt">max_dead_vol_wt</option>
          </SelectField>
          <SelectField label="Weight Slab Based Billing" value={billingConfig.weightSlabBasedBilling || 'No'} onChange={(value) => updateBilling('weightSlabBasedBilling', value)}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </SelectField>
        </SimpleGrid>
        <Checkbox
          mt={3}
          isChecked={billingConfig.roundOff === true || String(billingConfig.roundOff || '').toLowerCase() === 'yes'}
          onChange={(event) => updateBilling('roundOff', event.target.checked ? 'yes' : 'no')}
        >
          Round-off charged weight
        </Checkbox>
      </Box>
    </Box>
  )
})

CFTAdvancedConfigSection.displayName = 'CFTAdvancedConfigSection'

export default CFTAdvancedConfigSection
