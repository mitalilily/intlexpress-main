import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import MetricTile from 'components/Admin/MetricTile'
import PageHeader from 'components/Admin/PageHeader'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import OrdersTable from 'components/Tables/OrdersTable'
import TableFilters from 'components/Tables/TableFilters'
import { useAvailableCouriersMutation } from 'hooks/useCouriers'
import { useAdminRtoKpis } from 'hooks/useOps'
import { useOrders } from 'hooks/useOrders'
import { useUserInfo } from 'hooks/useUser'
import { useSearchSellers } from 'hooks/useUsers'
import { useEffect, useMemo, useState } from 'react'
import { FiCheckCircle, FiPackage, FiRefreshCw, FiTruck } from 'react-icons/fi'
import { MdKeyboardReturn, MdOutlineArrowBack } from 'react-icons/md'
import { useHistory } from 'react-router-dom'
import {
  createAdminManualReverseOrder,
  createAdminReverseFromOrder,
  fetchAdminReverseQuote,
} from 'services/order.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GenericTable } from 'views/Dashboard/Tables/components/GenericTable'

const SUPPORTED_REVERSE_PROVIDERS = new Set([
  'amazon',
  'delhivery',
  'ekart',
  'shadowfax',
  'xpressbees',
])

const REVERSE_ORIGINAL_TAG_PREFIX = 'reverse_original_id='

const reverseFilterOptions = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search reverse order, AWB, merchant or customer',
  },
  {
    key: 'fromDate',
    label: 'From Date',
    type: 'date',
  },
  {
    key: 'toDate',
    label: 'To Date',
    type: 'date',
  },
]

const eligibleFilterOptions = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search delivered order, AWB or customer',
  },
  {
    key: 'fromDate',
    label: 'Delivered From',
    type: 'date',
  },
  {
    key: 'toDate',
    label: 'Delivered To',
    type: 'date',
  },
]

const makeEmptyItem = () => ({
  name: '',
  sku: '',
  qty: 1,
  price: 0,
  hsn: '',
  discount: 0,
  tax_rate: 0,
})

const createInitialManualForm = () => ({
  order_number: `REV-${Date.now()}`,
  tags: '',
  package_weight: '',
  package_length: '',
  package_breadth: '',
  package_height: '',
  consignee: {
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  },
  pickup: {
    warehouse_name: '',
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gst_number: '',
  },
  items: [makeEmptyItem()],
})

const formatCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`

const formatDateTime = (value) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeCourierResults = (value) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value.data)) return value.data
  if (Array.isArray(value.couriers)) return value.couriers
  if (Array.isArray(value.availableCouriers)) return value.availableCouriers
  if (Array.isArray(value.results)) return value.results
  return []
}

const getCourierOptionKey = (courier) =>
  String(courier?.courier_option_key ?? courier?.id ?? courier?.courier_id ?? '')

const getCourierRate = (courier) =>
  Number(courier?.rate ?? courier?.localRates?.forward?.rate ?? courier?.freight_charges ?? 0)

const getSupportedProvider = (order) =>
  String(order?.integration_type || '').trim().toLowerCase()

const isReverseProviderSupported = (order) =>
  SUPPORTED_REVERSE_PROVIDERS.has(getSupportedProvider(order))

const getMerchantName = (order) =>
  order?.merchantName || order?.company_name || order?.merchant_name || 'Merchant'

const extractReverseOriginalId = (tags) => {
  const parts = String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  const marker = parts.find((tag) =>
    tag.toLowerCase().startsWith(REVERSE_ORIGINAL_TAG_PREFIX),
  )

  return marker ? marker.slice(REVERSE_ORIGINAL_TAG_PREFIX.length) : null
}

const getProfilePayload = (result) => result?.data || result || null

const buildSellerCompanyMeta = (sellerProfile) => {
  const companyInfo = sellerProfile?.companyInfo || {}
  return {
    companyName:
      companyInfo.brandName ||
      companyInfo.businessName ||
      companyInfo.companyName ||
      sellerProfile?.companyName ||
      sellerProfile?.email ||
      '',
    gst:
      companyInfo.companyGst ||
      companyInfo.companyGST ||
      companyInfo.gst ||
      companyInfo.gstin ||
      companyInfo.GSTIN ||
      '',
    contactPerson:
      companyInfo.contactPerson || companyInfo.companyName || companyInfo.brandName || '',
    phone:
      companyInfo.companyContactNumber ||
      companyInfo.contactNumber ||
      companyInfo.contactPhone ||
      sellerProfile?.phone ||
      '',
    address: companyInfo.companyAddress || companyInfo.address || '',
    city: companyInfo.city || '',
    state: companyInfo.state || '',
    pincode: companyInfo.pincode || '',
  }
}

const buildReverseCreatePayloadFromOrder = (order, quote) => {
  const pickupDetails = order?.pickup_details || {}
  const pickupName =
    pickupDetails?.name || pickupDetails?.warehouse_name || getMerchantName(order)
  const reverseRate = Number(quote?.rate || 0)

  return {
    original_order_id: String(order.id),
    order_number: `${order.order_number || order.id}-R`,
    payment_type: 'reverse',
    order_amount: 0,
    order_date: new Date().toISOString(),
    shipping_charges: reverseRate,
    freight_charges: reverseRate,
    prepaid_amount: 0,
    is_rto_different: 'no',
    discount: 0,
    integration_type: order.integration_type,
    transaction_fee: 0,
    gift_wrap: 0,
    courier_id: quote?.courierId ? Number(quote.courierId) : undefined,
    selected_max_slab_weight: quote?.max_slab_weight ?? undefined,
    request_auto_pickup: 'Yes',
    pickup_location_id: order?.pickup_location_id || pickupDetails?.warehouse_name || undefined,
    consignee: {
      name: order?.buyer_name || 'Customer',
      address: order?.address || '',
      city: order?.city || '',
      state: order?.state || '',
      pincode: order?.pincode || '',
      email: order?.buyer_email || '',
      phone: order?.buyer_phone || '',
    },
    pickup: {
      warehouse_name: pickupDetails?.warehouse_name || pickupName,
      address: pickupDetails?.address || '',
      name: pickupName,
      phone: pickupDetails?.phone || '',
      city: pickupDetails?.city || '',
      state: pickupDetails?.state || '',
      pincode: pickupDetails?.pincode || '',
    },
    rto: {
      warehouse_name: pickupDetails?.warehouse_name || pickupName,
      address: pickupDetails?.address || '',
      name: pickupName,
      phone: pickupDetails?.phone || '',
      city: pickupDetails?.city || '',
      state: pickupDetails?.state || '',
      pincode: pickupDetails?.pincode || '',
    },
    order_items: Array.isArray(order?.products)
      ? order.products.map((item) => ({
          name: item?.name || item?.productName || 'Item',
          sku: item?.sku || 'NA',
          qty: Number(item?.qty ?? item?.quantity ?? 1),
          price: Number(item?.price ?? 0),
          hsn: item?.hsn || item?.hsnCode || '',
          discount: Number(item?.discount ?? 0),
          tax_rate: Number(item?.tax_rate ?? item?.taxRate ?? 0),
        }))
      : [makeEmptyItem()],
  }
}

function SectionCard({ title, description, children }) {
  const borderColor = useColorModeValue('rgba(148, 163, 184, 0.26)', 'rgba(148, 163, 184, 0.18)')
  const muted = useColorModeValue('gray.600', 'gray.300')

  return (
    <Card borderRadius="8px" borderWidth="1px" borderColor={borderColor}>
      <CardBody>
        <Stack spacing={4}>
          <Box>
            <Text fontSize="lg" fontWeight="800">
              {title}
            </Text>
            {description ? (
              <Text mt={1} fontSize="sm" color={muted}>
                {description}
              </Text>
            ) : null}
          </Box>
          {children}
        </Stack>
      </CardBody>
    </Card>
  )
}

export default function AdminReverseOrders() {
  const history = useHistory()
  const toast = useToast()
  const queryClient = useQueryClient()
  const reverseCreateModal = useDisclosure()
  const sellerHoverBg = useColorModeValue('gray.50', 'whiteAlpha.100')

  const [tabIndex, setTabIndex] = useState(0)

  const [reversePage, setReversePage] = useState(1)
  const [reversePerPage, setReversePerPage] = useState(10)
  const [reverseFilters, setReverseFilters] = useState({
    search: '',
    fromDate: '',
    toDate: '',
  })

  const [eligiblePage, setEligiblePage] = useState(1)
  const [eligiblePerPage, setEligiblePerPage] = useState(10)
  const [eligibleFilters, setEligibleFilters] = useState({
    search: '',
    fromDate: '',
    toDate: '',
  })

  const [selectedDeliveredOrder, setSelectedDeliveredOrder] = useState(null)

  const [sellerSearch, setSellerSearch] = useState('')
  const [selectedSeller, setSelectedSeller] = useState(null)
  const [manualForm, setManualForm] = useState(createInitialManualForm)
  const [manualCourierResults, setManualCourierResults] = useState([])
  const [selectedCourierKey, setSelectedCourierKey] = useState('')

  const reverseOrdersQuery = useOrders(reversePage, reversePerPage, {
    ...reverseFilters,
    orderType: 'reverse',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  const reverseIndexQuery = useOrders(1, 5000, {
    orderType: 'reverse',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  const eligibleOrdersQuery = useOrders(eligiblePage, eligiblePerPage, {
    ...eligibleFilters,
    orderType: 'forward',
    status: 'delivered',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  const { data: sellerSearchData, isFetching: isSellerSearchFetching } = useSearchSellers(
    sellerSearch,
    8,
  )
  const sellerInfoQuery = useUserInfo(selectedSeller?.id)
  const { data: rtoKpisData } = useAdminRtoKpis({})
  const availableCouriersMutation = useAvailableCouriersMutation()

  const quoteReverseMutation = useMutation({
    mutationFn: fetchAdminReverseQuote,
  })

  const createReverseMutation = useMutation({
    mutationFn: createAdminReverseFromOrder,
    onSuccess: () => {
      toast({
        title: 'Reverse order created',
        description: 'The reverse pickup was created and added to the reverse queue.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
      reverseCreateModal.onClose()
      setSelectedDeliveredOrder(null)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error) => {
      toast({
        title: 'Reverse order creation failed',
        description:
          error?.response?.data?.message || error?.message || 'Unable to create reverse order.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    },
  })

  const createManualReverseMutation = useMutation({
    mutationFn: createAdminManualReverseOrder,
    onSuccess: () => {
      toast({
        title: 'Manual reverse order created',
        description: 'The reverse pickup was created successfully.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setManualCourierResults([])
      setSelectedCourierKey('')
      setManualForm((prev) => ({
        ...createInitialManualForm(),
        pickup: prev.pickup,
      }))
      setTabIndex(0)
    },
    onError: (error) => {
      toast({
        title: 'Manual reverse creation failed',
        description:
          error?.response?.data?.message || error?.message || 'Unable to create manual reverse order.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    },
  })

  const reverseOrders = reverseOrdersQuery.data?.orders || []
  const eligibleOrders = eligibleOrdersQuery.data?.orders || []
  const reverseIndexOrders = reverseIndexQuery.data?.orders || []
  const sellerProfile = getProfilePayload(sellerInfoQuery.data)
  const sellerCompanyMeta = buildSellerCompanyMeta(sellerProfile)
  const sellerResults = sellerSearchData?.data || []

  const reverseOriginalIds = useMemo(() => {
    const ids = new Set()
    reverseIndexOrders.forEach((order) => {
      const originalId = extractReverseOriginalId(order?.tags)
      if (originalId) ids.add(String(originalId))
    })
    return ids
  }, [reverseIndexOrders])

  const reverseOrderNumberPrefixes = useMemo(() => {
    const prefixes = new Set()
    reverseIndexOrders.forEach((order) => {
      const orderNumber = String(order?.order_number || '').trim().toLowerCase()
      const suffixIndex = orderNumber.indexOf('-r')
      if (suffixIndex > 0) {
        prefixes.add(orderNumber.slice(0, suffixIndex))
      }
    })
    return prefixes
  }, [reverseIndexOrders])

  const eligibleTableRows = useMemo(
    () =>
      eligibleOrders.map((order) => {
        const supported = isReverseProviderSupported(order)
        const alreadyCreated =
          reverseOriginalIds.has(String(order.id)) ||
          reverseOrderNumberPrefixes.has(String(order?.order_number || '').trim().toLowerCase())

        return {
          ...order,
          supported,
          alreadyCreated,
        }
      }),
    [eligibleOrders, reverseOriginalIds, reverseOrderNumberPrefixes],
  )

  const selectedQuotedOrder = quoteReverseMutation.data?.order
  const selectedQuote = quoteReverseMutation.data?.quote

  const selectedManualCourier = useMemo(
    () =>
      manualCourierResults.find((courier) => getCourierOptionKey(courier) === selectedCourierKey) ||
      null,
    [manualCourierResults, selectedCourierKey],
  )

  useEffect(() => {
    if (!sellerProfile) return

    setManualForm((prev) => ({
      ...prev,
      pickup: {
        ...prev.pickup,
        warehouse_name: prev.pickup.warehouse_name || sellerCompanyMeta.companyName,
        name: prev.pickup.name || sellerCompanyMeta.contactPerson || sellerCompanyMeta.companyName,
        phone: prev.pickup.phone || sellerCompanyMeta.phone,
        address: prev.pickup.address || sellerCompanyMeta.address,
        city: prev.pickup.city || sellerCompanyMeta.city,
        state: prev.pickup.state || sellerCompanyMeta.state,
        pincode: prev.pickup.pincode || sellerCompanyMeta.pincode,
        gst_number: prev.pickup.gst_number || sellerCompanyMeta.gst,
      },
    }))
  }, [
    sellerCompanyMeta.address,
    sellerCompanyMeta.city,
    sellerCompanyMeta.companyName,
    sellerCompanyMeta.contactPerson,
    sellerCompanyMeta.gst,
    sellerCompanyMeta.phone,
    sellerCompanyMeta.pincode,
    sellerCompanyMeta.state,
    sellerProfile,
  ])

  const reverseStats = useMemo(
    () => ({
      totalReverse: reverseOrdersQuery.data?.totalCount || 0,
      eligibleDelivered: eligibleOrdersQuery.data?.totalCount || 0,
      createdFromForward: reverseOriginalIds.size,
      rtoEvents: rtoKpisData?.data?.total || 0,
    }),
    [
      eligibleOrdersQuery.data?.totalCount,
      reverseOrdersQuery.data?.totalCount,
      reverseOriginalIds.size,
      rtoKpisData?.data?.total,
    ],
  )

  const updateManualField = (field, value) => {
    setManualForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateManualNestedField = (section, field, value) => {
    setManualForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }))
  }

  const updateManualItemField = (index, field, value) => {
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }))
  }

  const addManualItem = () => {
    setManualForm((prev) => ({
      ...prev,
      items: [...prev.items, makeEmptyItem()],
    }))
  }

  const removeManualItem = (index) => {
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.length === 1 ? prev.items : prev.items.filter((_, i) => i !== index),
    }))
  }

  const handleOpenReverseCreate = async (order) => {
    setSelectedDeliveredOrder(order)
    reverseCreateModal.onOpen()
    quoteReverseMutation.reset()

    try {
      await quoteReverseMutation.mutateAsync({ original_order_id: order.id })
    } catch (error) {
      toast({
        title: 'Reverse quote failed',
        description:
          error?.response?.data?.message || error?.message || 'Unable to fetch reverse quote.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleConfirmReverseCreate = async () => {
    if (!selectedDeliveredOrder || !selectedQuote) return
    const payload = buildReverseCreatePayloadFromOrder(selectedDeliveredOrder, selectedQuote)
    await createReverseMutation.mutateAsync(payload)
  }

  const handleFindManualCouriers = async () => {
    if (!selectedSeller?.id) {
      toast({
        title: 'Select a seller first',
        description: 'Pick the merchant for whom the reverse order should be created.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    const requiredPairs = [
      ['Customer pickup pincode', manualForm.consignee.pincode],
      ['Return warehouse pincode', manualForm.pickup.pincode],
      ['Package weight', manualForm.package_weight],
      ['Package length', manualForm.package_length],
      ['Package breadth', manualForm.package_breadth],
      ['Package height', manualForm.package_height],
    ]

    const missing = requiredPairs.find(([, value]) => !String(value || '').trim())
    if (missing) {
      toast({
        title: `${missing[0]} is required`,
        status: 'warning',
        duration: 3500,
        isClosable: true,
      })
      return
    }

    try {
      const response = await availableCouriersMutation.mutateAsync({
        pickupPincode: manualForm.consignee.pincode,
        deliveryPincode: manualForm.pickup.pincode,
        paymentType: 'reverse',
        shipmentType: 'reverse',
        weight: Number(manualForm.package_weight || 0),
        length: Number(manualForm.package_length || 0),
        breadth: Number(manualForm.package_breadth || 0),
        height: Number(manualForm.package_height || 0),
        planId: sellerProfile?.currentPlanId || undefined,
      })

      const normalized = normalizeCourierResults(response)
      setManualCourierResults(normalized)
      setSelectedCourierKey(normalized[0] ? getCourierOptionKey(normalized[0]) : '')

      toast({
        title: normalized.length ? 'Reverse courier options loaded' : 'No reverse courier found',
        description: normalized.length
          ? 'Select the courier you want to use for the manual reverse order.'
          : 'Try another pincode or package combination.',
        status: normalized.length ? 'success' : 'warning',
        duration: 4000,
        isClosable: true,
      })
    } catch (error) {
      toast({
        title: 'Courier lookup failed',
        description:
          error?.response?.data?.message || error?.message || 'Unable to fetch reverse couriers.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleCreateManualReverse = async () => {
    if (!selectedSeller?.id) {
      toast({
        title: 'Seller is required',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (!selectedManualCourier) {
      toast({
        title: 'Select a courier',
        description: 'Fetch reverse couriers and choose one before creating the order.',
        status: 'warning',
        duration: 3500,
        isClosable: true,
      })
      return
    }

    const requiredTextFields = [
      ['Order number', manualForm.order_number],
      ['Customer name', manualForm.consignee.name],
      ['Customer phone', manualForm.consignee.phone],
      ['Customer address', manualForm.consignee.address],
      ['Customer city', manualForm.consignee.city],
      ['Customer state', manualForm.consignee.state],
      ['Customer pincode', manualForm.consignee.pincode],
      ['Warehouse name', manualForm.pickup.warehouse_name],
      ['Warehouse contact name', manualForm.pickup.name],
      ['Warehouse phone', manualForm.pickup.phone],
      ['Warehouse address', manualForm.pickup.address],
      ['Warehouse city', manualForm.pickup.city],
      ['Warehouse state', manualForm.pickup.state],
      ['Warehouse pincode', manualForm.pickup.pincode],
    ]

    const missingField = requiredTextFields.find(([, value]) => !String(value || '').trim())
    if (missingField) {
      toast({
        title: `${missingField[0]} is required`,
        status: 'warning',
        duration: 3500,
        isClosable: true,
      })
      return
    }

    const validItems = manualForm.items
      .map((item) => ({
        ...item,
        name: String(item.name || '').trim(),
        sku: String(item.sku || 'NA').trim() || 'NA',
        qty: Number(item.qty || 0),
        price: Number(item.price || 0),
        hsn: String(item.hsn || '').trim(),
        discount: Number(item.discount || 0),
        tax_rate: Number(item.tax_rate || 0),
      }))
      .filter((item) => item.name && item.qty > 0)

    if (!validItems.length) {
      toast({
        title: 'At least one item is required',
        description: 'Add at least one reverse pickup item before creating the order.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    const courierRate = getCourierRate(selectedManualCourier)
    const payload = {
      userId: selectedSeller.id,
      order_number: manualForm.order_number.trim(),
      order_date: new Date().toISOString(),
      payment_type: 'reverse',
      order_amount: 0,
      prepaid_amount: 0,
      package_weight: Number(manualForm.package_weight || 0),
      package_length: Number(manualForm.package_length || 0),
      package_breadth: Number(manualForm.package_breadth || 0),
      package_height: Number(manualForm.package_height || 0),
      shipping_charges: courierRate,
      freight_charges: courierRate,
      courier_id: Number(selectedManualCourier?.id ?? selectedManualCourier?.courier_id ?? 0),
      courier_partner:
        selectedManualCourier?.name || selectedManualCourier?.courier_name || 'Reverse Courier',
      integration_type:
        selectedManualCourier?.integration_type ||
        selectedManualCourier?.serviceProvider ||
        selectedManualCourier?.service_provider,
      courier_option_key: selectedManualCourier?.courier_option_key || undefined,
      selected_max_slab_weight:
        selectedManualCourier?.localRates?.forward?.max_slab_weight ??
        selectedManualCourier?.max_slab_weight ??
        null,
      request_auto_pickup: 'Yes',
      is_rto_different: 'no',
      consignee: {
        name: manualForm.consignee.name.trim(),
        address: manualForm.consignee.address.trim(),
        city: manualForm.consignee.city.trim(),
        state: manualForm.consignee.state.trim(),
        pincode: manualForm.consignee.pincode.trim(),
        email: manualForm.consignee.email.trim(),
        phone: manualForm.consignee.phone.trim(),
      },
      pickup_location_id: manualForm.pickup.warehouse_name.trim(),
      pickup: {
        warehouse_name: manualForm.pickup.warehouse_name.trim(),
        name: manualForm.pickup.name.trim(),
        phone: manualForm.pickup.phone.trim(),
        address: manualForm.pickup.address.trim(),
        city: manualForm.pickup.city.trim(),
        state: manualForm.pickup.state.trim(),
        pincode: manualForm.pickup.pincode.trim(),
        gst_number: manualForm.pickup.gst_number.trim(),
      },
      rto: {
        warehouse_name: manualForm.pickup.warehouse_name.trim(),
        name: manualForm.pickup.name.trim(),
        phone: manualForm.pickup.phone.trim(),
        address: manualForm.pickup.address.trim(),
        city: manualForm.pickup.city.trim(),
        state: manualForm.pickup.state.trim(),
        pincode: manualForm.pickup.pincode.trim(),
      },
      company: {
        name: sellerCompanyMeta.companyName,
        gst: sellerCompanyMeta.gst,
      },
      order_items: validItems,
      tags: [manualForm.tags.trim(), 'reverse_manual_admin']
        .filter(Boolean)
        .join(','),
    }

    await createManualReverseMutation.mutateAsync(payload)
  }

  const eligibleCaptions = [
    'Delivered Order',
    'Merchant',
    'Customer Pickup',
    'Courier',
    'Status',
    'Delivered At',
  ]

  const eligibleColumnKeys = [
    'order_number',
    'merchantName',
    'buyer_name',
    'courier_partner',
    'order_status',
    'updated_at',
  ]

  const courierSummaryText = selectedManualCourier
    ? `${selectedManualCourier?.name || 'Courier'} • ${formatCurrency(
        getCourierRate(selectedManualCourier),
      )} • ${selectedManualCourier?.edd || 'EDD pending'}`
    : 'No courier selected yet'

  return (
    <Box pt={{ base: '120px', md: '75px' }}>
      <Stack spacing={6}>
        <PageHeader
          eyebrow="Operations / Reverse Orders"
          title="Reverse pickup desk for post-delivery returns"
          description="Reverse orders are customer-initiated return pickups after a forward shipment has already been delivered. RTO is different: it is a failed forward shipment going back to the seller. Both live under Operations, but they need separate queues, actions, and monitoring."
          meta={[
            { label: 'Reverse queue', value: reverseStats.totalReverse.toLocaleString() },
            { label: 'Eligible delivered', value: reverseStats.eligibleDelivered.toLocaleString() },
            { label: 'RTO events', value: reverseStats.rtoEvents.toLocaleString() },
          ]}
          actions={
            <HStack spacing={3} flexWrap="wrap">
              <Button
                leftIcon={<MdOutlineArrowBack />}
                variant="outline"
                size="sm"
                borderRadius="8px"
                onClick={() => history.push('/admin/ops/rto')}
              >
                Open RTO Desk
              </Button>
              <Button
                leftIcon={<FiRefreshCw />}
                variant="outline"
                size="sm"
                borderRadius="8px"
                onClick={() => {
                  reverseOrdersQuery.refetch()
                  eligibleOrdersQuery.refetch()
                  reverseIndexQuery.refetch()
                }}
                isLoading={reverseOrdersQuery.isFetching || eligibleOrdersQuery.isFetching}
              >
                Refresh
              </Button>
            </HStack>
          }
        />

        <Grid
          templateColumns={{
            base: '1fr',
            md: 'repeat(2, 1fr)',
            xl: 'repeat(4, 1fr)',
          }}
          gap={4}
        >
          <MetricTile
            label="Reverse Queue"
            value={reverseStats.totalReverse}
            muted="All reverse pickup orders created so far"
            icon={<Icon as={MdKeyboardReturn} w={5} h={5} />}
          />
          <MetricTile
            label="Eligible Delivered"
            value={reverseStats.eligibleDelivered}
            muted="Forward delivered orders that can be checked for reverse"
            accent="green.500"
            icon={<Icon as={FiCheckCircle} w={5} h={5} />}
          />
          <MetricTile
            label="Linked To Forward"
            value={reverseStats.createdFromForward}
            muted="Reverse pickups already attached to original orders"
            accent="orange.500"
            icon={<Icon as={FiTruck} w={5} h={5} />}
          />
          <MetricTile
            label="RTO Desk"
            value={reverseStats.rtoEvents}
            muted="Failed forward returns tracked separately"
            accent="red.500"
            icon={<Icon as={FiPackage} w={5} h={5} />}
            onClick={() => history.push('/admin/ops/rto')}
          />
        </Grid>

        <Alert status="info" borderRadius="8px">
          <AlertIcon />
          <Box>
            <AlertTitle fontSize="sm">How reverse orders are usually placed</AlertTitle>
            <AlertDescription fontSize="sm">
              A buyer raises a return or replacement request after delivery, operations verifies eligibility, and then a reverse pickup is booked from the customer address back to the merchant warehouse. That is why this desk starts with delivered forward orders instead of RTO events.
            </AlertDescription>
          </Box>
        </Alert>

        <Tabs
          index={tabIndex}
          onChange={setTabIndex}
          variant="enclosed"
          colorScheme="blue"
        >
          <TabList overflowX="auto">
            <Tab>Reverse Orders</Tab>
            <Tab>Eligible Delivered Orders</Tab>
            <Tab>Manual Create</Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0} pt={5}>
              <Stack spacing={5}>
                <TableFilters
                  filters={reverseFilterOptions}
                  values={reverseFilters}
                  onApply={(appliedFilters) => {
                    setReverseFilters(appliedFilters)
                    setReversePage(1)
                  }}
                />

                <OrdersTable
                  orders={reverseOrders}
                  totalCount={reverseOrdersQuery.data?.totalCount || 0}
                  page={reversePage}
                  setPage={setReversePage}
                  perPage={reversePerPage}
                  setPerPage={setReversePerPage}
                  loading={reverseOrdersQuery.isLoading || reverseOrdersQuery.isFetching}
                  onRefresh={reverseOrdersQuery.refetch}
                />
              </Stack>
            </TabPanel>

            <TabPanel px={0} pt={5}>
              <Stack spacing={5}>
                <TableFilters
                  filters={eligibleFilterOptions}
                  values={eligibleFilters}
                  onApply={(appliedFilters) => {
                    setEligibleFilters(appliedFilters)
                    setEligiblePage(1)
                  }}
                />

                <Alert status="info" borderRadius="8px">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    This queue shows delivered forward shipments. Use it when the customer asks for
                    a return pickup after successful delivery.
                  </AlertDescription>
                </Alert>

                <GenericTable
                  paginated
                  title="Delivered Orders Ready For Reverse Review"
                  data={eligibleTableRows}
                  captions={eligibleCaptions}
                  columnKeys={eligibleColumnKeys}
                  page={eligiblePage}
                  setPage={setEligiblePage}
                  totalCount={eligibleOrdersQuery.data?.totalCount || 0}
                  perPage={eligiblePerPage}
                  setPerPage={setEligiblePerPage}
                  loading={eligibleOrdersQuery.isLoading || eligibleOrdersQuery.isFetching}
                  renderers={{
                    order_number: (value, row) => (
                      <Stack spacing={0.5}>
                        <Text fontWeight="700">{value}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {row?.awb_number || 'AWB pending'}
                        </Text>
                      </Stack>
                    ),
                    merchantName: (_, row) => (
                      <Stack spacing={0.5}>
                        <Text fontWeight="600">{getMerchantName(row)}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {row?.user_id || '—'}
                        </Text>
                      </Stack>
                    ),
                    buyer_name: (_, row) => (
                      <Stack spacing={0.5}>
                        <Text fontWeight="600">{row?.buyer_name || 'Customer'}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {[row?.city, row?.state, row?.pincode].filter(Boolean).join(', ') || '—'}
                        </Text>
                      </Stack>
                    ),
                    courier_partner: (_, row) => (
                      <Stack spacing={1} align="flex-start">
                        <Text fontWeight="600">
                          {row?.courier_partner || row?.integration_type || '—'}
                        </Text>
                        <Badge colorScheme={row?.supported ? 'green' : 'gray'}>
                          {row?.supported ? 'Reverse Supported' : 'Not Supported'}
                        </Badge>
                      </Stack>
                    ),
                    order_status: (value, row) => (
                      <Stack spacing={1} align="flex-start">
                        <Badge colorScheme="green">{value}</Badge>
                        {row?.alreadyCreated ? (
                          <Badge colorScheme="purple">Reverse Already Created</Badge>
                        ) : null}
                      </Stack>
                    ),
                    updated_at: (value) => <Text fontSize="sm">{formatDateTime(value)}</Text>,
                  }}
                  renderActions={(row) => (
                    <Button
                      size="sm"
                      leftIcon={<MdKeyboardReturn />}
                      colorScheme="blue"
                      borderRadius="8px"
                      onClick={() => handleOpenReverseCreate(row)}
                      isDisabled={!row?.supported || row?.alreadyCreated}
                    >
                      {row?.alreadyCreated ? 'Already Created' : 'Create Reverse'}
                    </Button>
                  )}
                />
              </Stack>
            </TabPanel>

            <TabPanel px={0} pt={5}>
              <Stack spacing={5}>
                <SectionCard
                  title="Merchant & Order Setup"
                  description="Use this when the reverse pickup needs to be created manually instead of starting from an existing delivered order."
                >
                  <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                    <Box>
                      <FormControl>
                        <FormLabel>Search Seller</FormLabel>
                        <Input
                          placeholder="Type merchant name or email"
                          value={sellerSearch}
                          onChange={(event) => setSellerSearch(event.target.value)}
                        />
                      </FormControl>
                      {sellerSearch.trim().length >= 2 ? (
                        <Box
                          mt={2}
                          borderWidth="1px"
                          borderRadius="8px"
                          overflow="hidden"
                          maxH="240px"
                          overflowY="auto"
                        >
                          {isSellerSearchFetching ? (
                            <Text px={3} py={2} fontSize="sm" color="gray.500">
                              Searching sellers...
                            </Text>
                          ) : sellerResults.length ? (
                            sellerResults.map((seller) => (
                              <Box
                                key={seller.id}
                                px={3}
                                py={2.5}
                                cursor="pointer"
                                borderBottomWidth="1px"
                                _hover={{ bg: sellerHoverBg }}
                                onClick={() => {
                                  setSelectedSeller(seller)
                                  setSellerSearch(seller.label || seller.companyName || seller.email)
                                }}
                              >
                                <Text fontWeight="700">{seller.label || seller.companyName}</Text>
                                <Text fontSize="xs" color="gray.500">
                                  {seller.email || seller.contactPerson || seller.id}
                                </Text>
                              </Box>
                            ))
                          ) : (
                            <Text px={3} py={2} fontSize="sm" color="gray.500">
                              No sellers found
                            </Text>
                          )}
                        </Box>
                      ) : null}
                    </Box>

                    <Stack spacing={3}>
                      <FormControl>
                        <FormLabel>Reverse Order Number</FormLabel>
                        <Input
                          value={manualForm.order_number}
                          onChange={(event) => updateManualField('order_number', event.target.value)}
                          placeholder="REV-20260628-001"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Tags / Notes</FormLabel>
                        <Input
                          value={manualForm.tags}
                          onChange={(event) => updateManualField('tags', event.target.value)}
                          placeholder="return_exchange, damaged_box"
                        />
                      </FormControl>
                    </Stack>
                  </SimpleGrid>

                  {selectedSeller ? (
                    <Alert status="success" borderRadius="8px">
                      <AlertIcon />
                      <Box>
                        <AlertTitle fontSize="sm">
                          Selected seller: {selectedSeller.label || selectedSeller.companyName}
                        </AlertTitle>
                        <AlertDescription fontSize="sm">
                          Plan: {sellerProfile?.currentPlanId || 'No active plan found'} • Return
                          warehouse fields are being prefetched from the seller profile.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  ) : null}
                </SectionCard>

                <SectionCard
                  title="Customer Pickup Address"
                  description="In a reverse pickup, this is the location from which the courier will collect the shipment."
                >
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Name</FormLabel>
                      <Input
                        value={manualForm.consignee.name}
                        onChange={(event) =>
                          updateManualNestedField('consignee', 'name', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Phone</FormLabel>
                      <Input
                        value={manualForm.consignee.phone}
                        onChange={(event) =>
                          updateManualNestedField('consignee', 'phone', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Email</FormLabel>
                      <Input
                        value={manualForm.consignee.email}
                        onChange={(event) =>
                          updateManualNestedField('consignee', 'email', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Pincode</FormLabel>
                      <Input
                        value={manualForm.consignee.pincode}
                        onChange={(event) =>
                          updateManualNestedField('consignee', 'pincode', event.target.value)
                        }
                      />
                    </FormControl>
                  </SimpleGrid>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>City</FormLabel>
                      <Input
                        value={manualForm.consignee.city}
                        onChange={(event) =>
                          updateManualNestedField('consignee', 'city', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>State</FormLabel>
                      <Input
                        value={manualForm.consignee.state}
                        onChange={(event) =>
                          updateManualNestedField('consignee', 'state', event.target.value)
                        }
                      />
                    </FormControl>
                  </SimpleGrid>

                  <FormControl>
                    <FormLabel>Address</FormLabel>
                    <Textarea
                      value={manualForm.consignee.address}
                      onChange={(event) =>
                        updateManualNestedField('consignee', 'address', event.target.value)
                      }
                      rows={3}
                    />
                  </FormControl>
                </SectionCard>

                <SectionCard
                  title="Return Warehouse"
                  description="This is where the shipment will be returned after the customer pickup succeeds."
                >
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Warehouse Name</FormLabel>
                      <Input
                        value={manualForm.pickup.warehouse_name}
                        onChange={(event) =>
                          updateManualNestedField('pickup', 'warehouse_name', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Contact Name</FormLabel>
                      <Input
                        value={manualForm.pickup.name}
                        onChange={(event) =>
                          updateManualNestedField('pickup', 'name', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Phone</FormLabel>
                      <Input
                        value={manualForm.pickup.phone}
                        onChange={(event) =>
                          updateManualNestedField('pickup', 'phone', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>GST Number</FormLabel>
                      <Input
                        value={manualForm.pickup.gst_number}
                        onChange={(event) =>
                          updateManualNestedField('pickup', 'gst_number', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>City</FormLabel>
                      <Input
                        value={manualForm.pickup.city}
                        onChange={(event) =>
                          updateManualNestedField('pickup', 'city', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>State</FormLabel>
                      <Input
                        value={manualForm.pickup.state}
                        onChange={(event) =>
                          updateManualNestedField('pickup', 'state', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Pincode</FormLabel>
                      <Input
                        value={manualForm.pickup.pincode}
                        onChange={(event) =>
                          updateManualNestedField('pickup', 'pincode', event.target.value)
                        }
                      />
                    </FormControl>
                  </SimpleGrid>

                  <FormControl>
                    <FormLabel>Address</FormLabel>
                    <Textarea
                      value={manualForm.pickup.address}
                      onChange={(event) =>
                        updateManualNestedField('pickup', 'address', event.target.value)
                      }
                      rows={3}
                    />
                  </FormControl>
                </SectionCard>

                <SectionCard
                  title="Package & Courier"
                  description="Reverse serviceability is checked from the customer pickup pincode back to the seller warehouse."
                >
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Weight (g)</FormLabel>
                      <Input
                        type="number"
                        value={manualForm.package_weight}
                        onChange={(event) =>
                          updateManualField('package_weight', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Length (cm)</FormLabel>
                      <Input
                        type="number"
                        value={manualForm.package_length}
                        onChange={(event) =>
                          updateManualField('package_length', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Breadth (cm)</FormLabel>
                      <Input
                        type="number"
                        value={manualForm.package_breadth}
                        onChange={(event) =>
                          updateManualField('package_breadth', event.target.value)
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Height (cm)</FormLabel>
                      <Input
                        type="number"
                        value={manualForm.package_height}
                        onChange={(event) =>
                          updateManualField('package_height', event.target.value)
                        }
                      />
                    </FormControl>
                  </SimpleGrid>

                  <HStack spacing={3} flexWrap="wrap">
                    <Button
                      leftIcon={<FiTruck />}
                      colorScheme="blue"
                      borderRadius="8px"
                      onClick={handleFindManualCouriers}
                      isLoading={availableCouriersMutation.isPending}
                    >
                      Find Reverse Couriers
                    </Button>
                    <Text fontSize="sm" color="gray.500">
                      {courierSummaryText}
                    </Text>
                  </HStack>

                  <FormControl>
                    <FormLabel>Select Courier</FormLabel>
                    <Select
                      placeholder="Choose reverse courier"
                      value={selectedCourierKey}
                      onChange={(event) => setSelectedCourierKey(event.target.value)}
                    >
                      {manualCourierResults.map((courier) => (
                        <option key={getCourierOptionKey(courier)} value={getCourierOptionKey(courier)}>
                          {(courier?.name || 'Courier') +
                            ` • ${formatCurrency(getCourierRate(courier))} • ${courier?.edd || 'EDD pending'}`}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SectionCard>

                <SectionCard
                  title="Reverse Order Items"
                  description="Add the products or units the field executive is expected to collect from the customer."
                >
                  <Stack spacing={4}>
                    {manualForm.items.map((item, index) => (
                      <Box key={`${index}-${item.sku || 'item'}`}>
                        <SimpleGrid columns={{ base: 1, md: 2, xl: 6 }} spacing={4}>
                          <FormControl>
                            <FormLabel>Item Name</FormLabel>
                            <Input
                              value={item.name}
                              onChange={(event) =>
                                updateManualItemField(index, 'name', event.target.value)
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>SKU</FormLabel>
                            <Input
                              value={item.sku}
                              onChange={(event) =>
                                updateManualItemField(index, 'sku', event.target.value)
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Qty</FormLabel>
                            <Input
                              type="number"
                              value={item.qty}
                              onChange={(event) =>
                                updateManualItemField(index, 'qty', event.target.value)
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Price</FormLabel>
                            <Input
                              type="number"
                              value={item.price}
                              onChange={(event) =>
                                updateManualItemField(index, 'price', event.target.value)
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>HSN</FormLabel>
                            <Input
                              value={item.hsn}
                              onChange={(event) =>
                                updateManualItemField(index, 'hsn', event.target.value)
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Tax %</FormLabel>
                            <Input
                              type="number"
                              value={item.tax_rate}
                              onChange={(event) =>
                                updateManualItemField(index, 'tax_rate', event.target.value)
                              }
                            />
                          </FormControl>
                        </SimpleGrid>

                        <HStack justify="space-between" mt={3}>
                          <Text fontSize="sm" color="gray.500">
                            Discount: {formatCurrency(item.discount || 0)}
                          </Text>
                          <Button
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => removeManualItem(index)}
                            isDisabled={manualForm.items.length === 1}
                          >
                            Remove Item
                          </Button>
                        </HStack>

                        {index < manualForm.items.length - 1 ? <Divider mt={4} /> : null}
                      </Box>
                    ))}

                    <HStack spacing={3}>
                      <Button variant="outline" borderRadius="8px" onClick={addManualItem}>
                        Add Item
                      </Button>
                      <Button
                        colorScheme="blue"
                        borderRadius="8px"
                        onClick={handleCreateManualReverse}
                        isLoading={createManualReverseMutation.isPending}
                      >
                        Create Manual Reverse Order
                      </Button>
                    </HStack>
                  </Stack>
                </SectionCard>
              </Stack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Stack>

      <Modal isOpen={reverseCreateModal.isOpen} onClose={reverseCreateModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="8px">
          <ModalHeader>Create Reverse Pickup</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text fontSize="sm" color="gray.600">
                Reverse pickup is created after delivery when the customer asks for a return or exchange.
                The courier will collect from the buyer and send it back to the merchant warehouse.
              </Text>

              {selectedDeliveredOrder ? (
                <Box borderWidth="1px" borderRadius="8px" p={3}>
                  <Text fontWeight="700">{selectedDeliveredOrder.order_number}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {selectedDeliveredOrder.buyer_name || 'Customer'} •{' '}
                    {[selectedDeliveredOrder.city, selectedDeliveredOrder.state, selectedDeliveredOrder.pincode]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                  <Text fontSize="sm" color="gray.500" mt={2}>
                    Return warehouse:{' '}
                    {selectedDeliveredOrder?.pickup_details?.warehouse_name ||
                      selectedDeliveredOrder?.pickup_details?.name ||
                      getMerchantName(selectedDeliveredOrder)}
                  </Text>
                </Box>
              ) : null}

              {quoteReverseMutation.isPending ? (
                <Text fontSize="sm" color="gray.500">
                  Fetching reverse quote...
                </Text>
              ) : null}

              {selectedQuote ? (
                <Box borderWidth="1px" borderRadius="8px" p={3}>
                  <Stack spacing={2}>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.500">
                        Reverse freight
                      </Text>
                      <Text fontWeight="700">{formatCurrency(selectedQuote.rate)}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.500">
                        Courier
                      </Text>
                      <Text>{selectedQuotedOrder?.integration_type || 'Same courier family'}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.500">
                        Estimated delivery
                      </Text>
                      <Text>{selectedQuote.eddDays ? `${selectedQuote.eddDays} day(s)` : '—'}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.500">
                        ODA
                      </Text>
                      <Text>{selectedQuote.oda ? 'Yes' : 'No'}</Text>
                    </HStack>
                  </Stack>
                </Box>
              ) : null}

              {quoteReverseMutation.isError ? (
                <Alert status="error" borderRadius="8px">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    {quoteReverseMutation.error?.response?.data?.message ||
                      quoteReverseMutation.error?.message ||
                      'Unable to fetch reverse quote.'}
                  </AlertDescription>
                </Alert>
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="outline" onClick={reverseCreateModal.onClose}>
                Close
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleConfirmReverseCreate}
                isDisabled={!selectedQuote}
                isLoading={createReverseMutation.isPending}
              >
                Create Reverse Order
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
