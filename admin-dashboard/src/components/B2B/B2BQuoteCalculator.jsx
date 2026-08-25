import {
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
  useColorModeValue,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useCouriers } from '../../hooks/useCouriers'
import { b2bAdminService } from '../../services/b2bAdmin.service'
import Card from '../Card/Card'
import CardBody from '../Card/CardBody'
import CardHeader from '../Card/CardHeader'

const B2BQuoteCalculator = ({ planId }) => {
  const toast = useToast()
  const [formData, setFormData] = useState({
    originPincode: '',
    destinationPincode: '',
    weightKg: '',
    length: '',
    width: '',
    height: '',
    invoiceValue: '',
    paymentMode: 'PREPAID',
    freightMode: 'bill_to_client',
    rovType: 'owner_risk',
    courierId: '',
    serviceProvider: '',
  })
  const [quoteResult, setQuoteResult] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)

  const { data: couriers = [] } = useCouriers({ businessType: 'b2b' })

  useEffect(() => {
    if (formData.courierId || !couriers.length) return
    const firstCourier = couriers[0]
    setFormData((prev) => ({
      ...prev,
      courierId: String(firstCourier.id),
      serviceProvider: firstCourier.serviceProvider || firstCourier.service_provider || '',
    }))
  }, [couriers, formData.courierId])

  const handleCalculate = async () => {
    if (!formData.originPincode || !formData.destinationPincode || !formData.weightKg || !formData.courierId) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in origin, destination, weight, and courier',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setIsCalculating(true)
    try {
      const result = await b2bAdminService.calculateRate({
        originPincode: formData.originPincode,
        destinationPincode: formData.destinationPincode,
        weightKg: Number(formData.weightKg),
        length: formData.length ? Number(formData.length) : undefined,
        width: formData.width ? Number(formData.width) : undefined,
        height: formData.height ? Number(formData.height) : undefined,
        invoiceValue: formData.invoiceValue ? Number(formData.invoiceValue) : undefined,
        paymentMode: formData.paymentMode,
        freightMode: formData.freightMode,
        rovType: formData.rovType,
        courier_id: formData.courierId || undefined,
        service_provider: formData.serviceProvider || undefined,
        plan_id: planId || undefined,
      })
      setQuoteResult(result)
    } catch (error) {
      toast({
        title: 'Calculation failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsCalculating(false)
    }
  }

  const bgColor = useColorModeValue('white', 'gray.800')
  const cardBg = useColorModeValue('blue.50', 'blue.900')

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
      <Card bg={bgColor}>
        <CardHeader>
          <Text fontSize="lg" fontWeight="bold">
            Quote Calculator
          </Text>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <SimpleGrid columns={2} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Origin Pincode</FormLabel>
                <Input
                  value={formData.originPincode}
                  onChange={(e) => setFormData({ ...formData, originPincode: e.target.value })}
                  placeholder="110001"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Destination Pincode</FormLabel>
                <Input
                  value={formData.destinationPincode}
                  onChange={(e) => setFormData({ ...formData, destinationPincode: e.target.value })}
                  placeholder="400001"
                />
              </FormControl>
            </SimpleGrid>

            <SimpleGrid columns={2} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Weight (kg)</FormLabel>
                <NumberInput
                  value={formData.weightKg}
                  onChange={(_, value) => setFormData({ ...formData, weightKg: value })}
                  min={0}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel>Payment Mode</FormLabel>
                <Select
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                >
                  <option value="PREPAID">Prepaid</option>
                  <option value="COD">COD</option>
                </Select>
              </FormControl>
            </SimpleGrid>

            <SimpleGrid columns={2} spacing={4}>
              <FormControl>
                <FormLabel>Freight Mode</FormLabel>
                <Select
                  value={formData.freightMode}
                  onChange={(e) => setFormData({ ...formData, freightMode: e.target.value })}
                >
                  <option value="bill_to_client">Bill to client</option>
                  <option value="freight_on_delivery">Freight on delivery</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>ROV Type</FormLabel>
                <Select
                  value={formData.rovType}
                  onChange={(e) => setFormData({ ...formData, rovType: e.target.value })}
                >
                  <option value="owner_risk">ROV by owner</option>
                  <option value="carrier_risk">ROV by courier</option>
                </Select>
              </FormControl>
            </SimpleGrid>

            <Text fontSize="sm" fontWeight="semibold" color="gray.600">
              Dimensions (optional, for volumetric weight)
            </Text>
            <SimpleGrid columns={3} spacing={4}>
              <FormControl>
                <FormLabel>Length (cm)</FormLabel>
                <NumberInput
                  value={formData.length}
                  onChange={(_, value) => setFormData({ ...formData, length: value })}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel>Width (cm)</FormLabel>
                <NumberInput
                  value={formData.width}
                  onChange={(_, value) => setFormData({ ...formData, width: value })}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel>Height (cm)</FormLabel>
                <NumberInput
                  value={formData.height}
                  onChange={(_, value) => setFormData({ ...formData, height: value })}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
            </SimpleGrid>

            <SimpleGrid columns={2} spacing={4}>
              <FormControl>
                <FormLabel>Invoice Value (₹)</FormLabel>
                <NumberInput
                  value={formData.invoiceValue}
                  onChange={(_, value) => setFormData({ ...formData, invoiceValue: value })}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel>Courier</FormLabel>
                <Select
                  placeholder="Select courier"
                  value={formData.courierId}
                  onChange={(e) => {
                    const selectedCourier = couriers.find(
                      (courier) => String(courier.id) === e.target.value,
                    )
                    setFormData({
                      ...formData,
                      courierId: e.target.value,
                      serviceProvider:
                        selectedCourier?.serviceProvider ||
                        selectedCourier?.service_provider ||
                        formData.serviceProvider,
                    })
                  }}
                >
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel>Service Provider</FormLabel>
              <Select
                placeholder="Select Service Provider"
                value={formData.serviceProvider}
                onChange={(e) => setFormData({ ...formData, serviceProvider: e.target.value })}
              >
                <option value="delhivery">Delhivery</option>
              </Select>
            </FormControl>

            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleCalculate}
              isLoading={isCalculating}
            >
              Calculate Quote
            </Button>
          </VStack>
        </CardBody>
      </Card>

      {quoteResult && (
        <Card bg={cardBg}>
          <CardHeader>
            <Text fontSize="lg" fontWeight="bold">
              Quote Breakdown
            </Text>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  Route
                </Text>
                <Text fontWeight="semibold">
                  {quoteResult.origin?.zoneCode} ({quoteResult.origin?.zoneName}) →{' '}
                  {quoteResult.destination?.zoneCode} ({quoteResult.destination?.zoneName})
                </Text>
              </Box>

              {quoteResult.calculation && (
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    Weight Calculation
                  </Text>
                  <SimpleGrid columns={2} spacing={2} fontSize="sm">
                    <Text>Actual Weight: {quoteResult.calculation.actualWeight} kg</Text>
                    <Text>
                      Volumetric Weight: {quoteResult.calculation.volumetricWeight.toFixed(2)} kg
                    </Text>
                    <Text>
                      Billable Weight: {quoteResult.calculation.billableWeight.toFixed(2)} kg
                    </Text>
                    <Text>
                      {quoteResult.calculation.usedVolumetric
                        ? '✓ Using volumetric'
                        : 'Using actual'}
                    </Text>
                  </SimpleGrid>
                </Box>
              )}

              <Divider />

              <Box>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  Charges Breakdown
                </Text>
                <Table size="sm" variant="simple">
                  <Tbody>
                    <Tr>
                      <Td fontWeight="semibold">Base Freight</Td>
                      <Td isNumeric>₹{quoteResult.charges.baseFreight.toFixed(2)}</Td>
                    </Tr>
                    {quoteResult.charges.overheads.map((overhead) => (
                      <Tr key={overhead.id}>
                        <Td>{overhead.name}</Td>
                        <Td isNumeric>₹{overhead.amount.toFixed(2)}</Td>
                      </Tr>
                    ))}
                    <Tr borderTop="2px solid" borderColor="gray.300">
                      <Td fontWeight="bold">Total</Td>
                      <Td isNumeric fontWeight="bold">
                        ₹{quoteResult.charges.total.toFixed(2)}
                      </Td>
                    </Tr>
                  </Tbody>
                </Table>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      )}
    </SimpleGrid>
  )
}

export default B2BQuoteCalculator
