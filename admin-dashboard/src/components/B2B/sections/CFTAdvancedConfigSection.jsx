import {
  Box,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  useColorModeValue,
} from '@chakra-ui/react'
import { memo, useEffect, useState } from 'react'

const JsonTextarea = ({ label, helper, value, fallback, onChange, rows = 6 }) => {
  const [text, setText] = useState(JSON.stringify(value ?? fallback, null, 2))
  const [error, setError] = useState('')

  useEffect(() => {
    setText(JSON.stringify(value ?? fallback, null, 2))
  }, [value])

  const commit = (nextText) => {
    setText(nextText)
    try {
      const parsed = JSON.parse(nextText || 'null')
      setError('')
      onChange(parsed ?? fallback)
    } catch (err) {
      setError('Invalid JSON. Fix it before saving.')
    }
  }

  return (
    <FormControl isInvalid={Boolean(error)}>
      <FormLabel fontSize="sm" fontWeight="medium">
        {label}
      </FormLabel>
      <Textarea
        value={text}
        onChange={(event) => commit(event.target.value)}
        rows={rows}
        fontFamily="mono"
        fontSize="xs"
      />
      <FormHelperText fontSize="xs" color={error ? 'red.500' : undefined}>
        {error || helper}
      </FormHelperText>
    </FormControl>
  )
}

const toList = (value) =>
  String(value || '')
    .split(/[,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const listToText = (value) => (Array.isArray(value) ? value.join('\n') : '')

const CFTAdvancedConfigSection = memo(({ formData, onFieldChange }) => {
  const cardBg = useColorModeValue('cyan.50', 'cyan.900')
  const cardBorder = useColorModeValue('cyan.200', 'cyan.700')
  const odaConfig = formData.odaConfig || {}
  const fuelHikeConfig = formData.fuelHikeConfig || {}
  const serviceChargesConfig = formData.serviceChargesConfig || {}
  const billingConfig = formData.billingConfig || {}

  const updateOda = (key, value) => onFieldChange('odaConfig', { ...odaConfig, [key]: value })
  const updateFuel = (key, value) =>
    onFieldChange('fuelHikeConfig', { ...fuelHikeConfig, [key]: value })
  const updateBilling = (key, value) =>
    onFieldChange('billingConfig', { ...billingConfig, [key]: value })

  return (
    <Box>
      <Text fontSize="md" fontWeight="bold" color="cyan.700" mb={4}>
        8. CFT Advanced Config
      </Text>

      <Box mb={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={3}>
          ODA mode, exemptions and slabs
        </Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <FormControl>
            <FormLabel fontSize="sm" fontWeight="medium">
              ODA Apply Mode
            </FormLabel>
            <Select
              size="sm"
              value={odaConfig.mode || 'delivery'}
              onChange={(event) => updateOda('mode', event.target.value)}
            >
              <option value="delivery">Delivery pincode only</option>
              <option value="pickup">Pickup pincode only</option>
              <option value="both">Pickup or delivery pincode</option>
            </Select>
            <FormHelperText fontSize="xs">Matches sheet values 1 / 2 / 3.</FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm" fontWeight="medium">
              Pickup ODA Exemptions
            </FormLabel>
            <Textarea
              size="sm"
              rows={4}
              value={listToText(odaConfig.pickupExemptions)}
              onChange={(event) => updateOda('pickupExemptions', toList(event.target.value))}
            />
            <FormHelperText fontSize="xs">One pincode per line or comma separated.</FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm" fontWeight="medium">
              Delivery ODA Exemptions
            </FormLabel>
            <Textarea
              size="sm"
              rows={4}
              value={listToText(odaConfig.deliveryExemptions)}
              onChange={(event) => updateOda('deliveryExemptions', toList(event.target.value))}
            />
            <FormHelperText fontSize="xs">One pincode per line or comma separated.</FormHelperText>
          </FormControl>
        </SimpleGrid>

        <Box mt={4}>
          <JsonTextarea
            label="ODA Slabs"
            value={odaConfig.slabs || []}
            fallback={[]}
            onChange={(value) => updateOda('slabs', Array.isArray(value) ? value : [])}
            helper='Example: [{"lowerKg":0,"upperKg":200,"perKg":4,"minCharge":750},{"lowerKg":200,"upperKg":null,"perKg":4,"minCharge":750}]'
          />
        </Box>
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        <Box p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
          <JsonTextarea
            label="Handling Slabs"
            value={formData.handlingSlabs || []}
            fallback={[]}
            onChange={(value) => onFieldChange('handlingSlabs', Array.isArray(value) ? value : [])}
            helper='Example: [{"lowerKg":100,"upperKg":250,"charge":0,"chargeType":"flat"},{"lowerKg":400,"upperKg":null,"charge":3,"chargeType":"per_kg"}]'
          />
        </Box>

        <Box p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
          <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={3}>
            Fuel Hike / DPH
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl>
              <FormLabel fontSize="xs">Base Fuel Rate</FormLabel>
              <NumberInput
                size="sm"
                value={fuelHikeConfig.baseRate ?? ''}
                onChange={(_, value) => updateFuel('baseRate', value || '')}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Current Fuel Rate</FormLabel>
              <NumberInput
                size="sm"
                value={fuelHikeConfig.currentRate ?? ''}
                onChange={(_, value) => updateFuel('currentRate', value || '')}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Threshold</FormLabel>
              <NumberInput
                size="sm"
                value={fuelHikeConfig.threshold ?? ''}
                onChange={(_, value) => updateFuel('threshold', value || '')}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Threshold Type</FormLabel>
              <Select
                size="sm"
                value={fuelHikeConfig.thresholdType || 'amount'}
                onChange={(event) => updateFuel('thresholdType', event.target.value)}
              >
                <option value="amount">Rs/litre</option>
                <option value="percent">Percent</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Change in Fuel Rate</FormLabel>
              <NumberInput
                size="sm"
                value={fuelHikeConfig.changeInFuelRate ?? ''}
                onChange={(_, value) => updateFuel('changeInFuelRate', value || '')}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Change in Freight</FormLabel>
              <NumberInput
                size="sm"
                value={fuelHikeConfig.changeInFreight ?? ''}
                onChange={(_, value) => updateFuel('changeInFreight', value || '')}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Freight Change Type</FormLabel>
              <Select
                size="sm"
                value={fuelHikeConfig.changeInFreightType || 'percent'}
                onChange={(event) => updateFuel('changeInFreightType', event.target.value)}
              >
                <option value="percent">% on freight</option>
                <option value="amount_per_kg">Rs/kg</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Application</FormLabel>
              <Select
                size="sm"
                value={fuelHikeConfig.application || 'base_freight'}
                onChange={(event) => updateFuel('application', event.target.value)}
              >
                <option value="base_freight">Base freight only</option>
                <option value="base_freight_plus_oda">Base freight + ODA</option>
              </Select>
            </FormControl>
          </SimpleGrid>
          <Checkbox
            mt={3}
            isChecked={Boolean(fuelHikeConfig.allowNegative)}
            onChange={(event) => updateFuel('allowNegative', event.target.checked)}
          >
            Allow negative DPH if fuel falls below base rate
          </Checkbox>
        </Box>
      </SimpleGrid>

      <Box mt={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <JsonTextarea
          label="Other CFT Service Charges"
          value={serviceChargesConfig}
          fallback={{}}
          onChange={(value) => onFieldChange('serviceChargesConfig', value && typeof value === 'object' ? value : {})}
          rows={10}
          helper="Use this for CSD/Army, green tax, appointment, FM/LM, to-pay, cash handling, POD, Sunday/holiday delivery, ROV owner/courier."
        />
      </Box>

      <Box mt={4} p={4} bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={cardBorder}>
        <Text fontSize="sm" fontWeight="semibold" color="cyan.700" mb={3}>
          Billing Rules
        </Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <FormControl>
            <FormLabel fontSize="sm">Invoice Type</FormLabel>
            <Select
              size="sm"
              value={billingConfig.invoiceType || 'delivery'}
              onChange={(event) => updateBilling('invoiceType', event.target.value)}
            >
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Billing Cycle</FormLabel>
            <Select
              size="sm"
              value={billingConfig.billingCycle || 'monthly'}
              onChange={(event) => updateBilling('billingCycle', event.target.value)}
            >
              <option value="weekly">Weekly</option>
              <option value="bi-monthly">Bi-monthly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Billing Start Date</FormLabel>
            <Input
              size="sm"
              type="number"
              min={1}
              max={31}
              value={billingConfig.billingStartDate ?? 1}
              onChange={(event) => updateBilling('billingStartDate', Number(event.target.value || 1))}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Max Dead Weight / Package</FormLabel>
            <Input
              size="sm"
              type="number"
              value={billingConfig.maxDeadWeightPerPackage ?? ''}
              onChange={(event) =>
                updateBilling(
                  'maxDeadWeightPerPackage',
                  event.target.value === '' ? '' : Number(event.target.value),
                )
              }
            />
          </FormControl>
          <Checkbox
            isChecked={Boolean(billingConfig.roundOff)}
            onChange={(event) => updateBilling('roundOff', event.target.checked)}
          >
            Round off chargeable weight
          </Checkbox>
          <Checkbox
            isChecked={Boolean(billingConfig.weightSlabBasedBilling)}
            onChange={(event) => updateBilling('weightSlabBasedBilling', event.target.checked)}
          >
            Weight slab based billing
          </Checkbox>
        </SimpleGrid>
      </Box>
    </Box>
  )
})

CFTAdvancedConfigSection.displayName = 'CFTAdvancedConfigSection'

export default CFTAdvancedConfigSection
