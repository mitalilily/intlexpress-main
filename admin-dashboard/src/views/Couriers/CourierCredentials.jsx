import { CopyIcon } from '@chakra-ui/icons'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Input,
  Spinner,
  Stack,
  Switch,
  Text,
  Textarea,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import {
  useCourierCredentials,
  useDelhiveryB2BAppointmentBook,
  useDelhiveryB2BDocumentStatus,
  useDelhiveryB2BDocumentGenerate,
  useDelhiveryB2BLabelUrls,
  useDelhiveryB2BLrCopy,
  useDelhiveryB2BPickupRequestCancel,
  useDelhiveryB2BShipmentCancel,
  useDelhiveryB2BLogin,
  useDelhiveryB2BLogout,
  useDelhiveryB2BPickupRequestCreate,
  useDelhiveryB2BServiceability,
  useDelhiveryB2BShipmentTrack,
  useDelhiveryB2BTat,
  useDelhiveryB2BFreightEstimate,
  useDelhiveryB2BFreightCharges,
  useDelhiveryB2BClientWarehouseCreate,
  useDelhiveryB2BClientWarehouseUpdate,
  useDelhiveryB2BShipmentCreate,
  useDelhiveryB2BShipmentStatus,
  useDelhiveryB2BShipmentUpdate,
  useDelhiveryB2BShipmentUpdateStatus,
  useDelhiveryForgotPassword,
  useUpdateDelhiveryCredentials,
} from 'hooks/useCouriers'

const ACCOUNT_CODES = ['account_1', 'account_2', 'account_3']
const ACCOUNT_PRESETS = [
  {
    title: 'Delhivery B2C Credentials',
    defaultLabel: 'Delhivery B2C Account',
    description: 'Primary Delhivery account for B2C bookings and warehouse mappings.',
  },
  {
    title: 'Delhivery B2B Credentials',
    defaultLabel: 'Delhivery B2B Account',
    description: 'Use this card for Delhivery B2B credentials and B2B-specific pickup mappings.',
  },
  {
    title: 'Delhivery Backup Credentials',
    defaultLabel: 'Delhivery Backup Account',
    description: 'Optional spare or overflow Delhivery account.',
  },
]

const buildEmptyAccount = (index) => ({
  accountCode: ACCOUNT_CODES[index],
  accountLabel: ACCOUNT_PRESETS[index]?.defaultLabel || `Delhivery Account ${index + 1}`,
  apiBase: 'https://track.delhivery.com',
  clientName: '',
  apiKey: '',
  username: '',
  password: '',
  hasApiKey: false,
  apiKeyMasked: '',
  hasPassword: false,
  passwordMasked: '',
  hasB2BAuthToken: false,
  b2bAuthTokenExpiresAt: '',
  isActive: index === 0,
  isDefault: index === 0,
  pickupLocationIds: [],
  pickupLocationNames: [],
})

const normalizeArrayInput = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .filter((entry, index, source) => source.indexOf(entry) === index)
  }

  return String(value || '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, source) => source.indexOf(entry) === index)
}

const normalizeAccounts = (accounts) =>
  ACCOUNT_CODES.map((accountCode, index) => {
    const incoming = Array.isArray(accounts) ? accounts[index] : null
    const empty = buildEmptyAccount(index)

    return incoming
      ? {
          ...empty,
          ...incoming,
          accountCode,
          pickupLocationIds: Array.isArray(incoming.pickupLocationIds)
            ? incoming.pickupLocationIds
            : normalizeArrayInput(incoming.pickupLocationIds),
          pickupLocationNames: Array.isArray(incoming.pickupLocationNames)
            ? incoming.pickupLocationNames
            : normalizeArrayInput(incoming.pickupLocationNames),
        }
      : empty
  }).map((account, index, source) => ({
    ...account,
    isDefault:
      account.isDefault === true &&
      source.findIndex((entry) => entry.isDefault === true) === index,
  }))

const DEFAULT_B2B_TEST_INPUTS = {
  serviceabilityPincode: '122001',
  serviceabilityWeight: '1',
  tatOriginPin: '400093',
  tatDestinationPin: '122001',
  freightSourcePin: '400069',
  freightConsigneePin: '400069',
  freightWeightG: '100000',
  freightLengthCm: '11',
  freightWidthCm: '1.1',
  freightHeightCm: '11',
  freightBoxCount: '1',
  freightPaymentMode: 'prepaid',
  freightCodAmount: '',
  freightInvAmount: '123',
  freightMode: 'fod',
  freightRovInsurance: true,
  freightChargesLrns: '',
  warehouseName: 'Delhivery142',
  warehousePinCode: '400059',
  warehouseCity: 'Gurgaon',
  warehouseState: 'Haryana',
  warehouseCountry: 'India',
  warehouseAddress: 'Gurgaon',
  warehouseContactPerson: 'contact_person',
  warehousePhoneNumber: '9186676788',
  warehouseBusinessDay: 'TUE',
  warehouseBusinessStart: '07:00',
  warehouseBusinessClose: '08:30',
  warehousePickupStart: '13:00',
  warehousePickupClose: '16:00',
  warehouseReturnPin: '721657',
  warehouseReturnAddress: 'test',
  warehouseSameAsForwardAddress: false,
  shipmentPayloadText: JSON.stringify(
    {
      pickup_location_name: 'pass registered wh name',
      payment_mode: 'cod',
      cod_amount: 122,
      weight: 100,
      dropoff_location: {
        consignee_name: 'Utkarsh',
        address: 'sector 7a',
        city: 'jajpur',
        state: 'odisha',
        zip: '756043',
        phone: '9876543210',
        email: '',
      },
      rov_insurance: true,
      invoices: [
        { ewaybill: '', inv_num: 'I22331030453', inv_amt: 59729.67, inv_qr_code: '' },
        { ewaybill: '', inv_num: 'DEL/1122/0095407', inv_amt: '2520480.0', inv_qr_code: '' },
      ],
      shipment_details: [
        {
          order_id: 'oid1',
          box_count: 1,
          description: 'Test description',
          weight: 1000,
          waybills: [],
          master: false,
        },
      ],
      doc_data: [
        {
          doc_type: 'INVOICE_COPY',
          doc_meta: { invoice_num: ['1/2/2025'] },
        },
      ],
      fm_pickup: false,
      freight_mode: 'fop',
      billing_address: {
        name: 'String required',
        company: 'String required',
        consignor: 'String required',
        address: 'String required',
        city: 'String required',
        state: 'String required',
        pin: 'String required',
        phone: 'String required',
        pan_number: 'ABCDE1234F',
        gst_number: '',
      },
    },
    null,
    2,
  ),
  shipmentJobId: '',
  shipmentUpdateLrn: '220110457',
  shipmentUpdatePayloadText: JSON.stringify(
    {
      cod_amount: 0,
      consignee_name: 'rahul',
      consignee_address: 'jammu',
      consignee_pincode: '844120',
      consignee_phone: '9999999999',
      weight_g: 30,
      invoices: [{ inv_number: 'I22331030453', inv_amount: 59729.67, qr_code: '', ewaybill: '' }],
      cb: {
        uri: 'https://btob-api-dev.delhivery.com/docket/upload_callback',
        method: 'POST',
        authorization: 'Bearer Token',
      },
      dimensions: [{ width_cm: 5, height_cm: 4, length_cm: 3, box_count: 1 }],
      invoice_files_meta: [{ invoices: ['inv00'] }],
    },
    null,
    2,
  ),
  shipmentUpdateJobId: '',
  shipmentCancelLrn: '220110457',
  shipmentTrackLrn: '220110457',
  shipmentTrackAllWbns: false,
  appointmentLrn: '220192589',
  appointmentDate: '31/12/2026',
  appointmentSlot: '12:00 PM-03:00 PM',
  appointmentPoNumbers: '2273410057461',
  appointmentId: '',
  appointmentPoExpiryDate: '31/12/2026',
  pickupRequestWarehouse: 'test',
  pickupRequestDate: '2026-12-31',
  pickupRequestStartTime: '05:00:00',
  pickupRequestExpectedPackageCount: '1',
  pickupRequestId: '',
  pickupCancelId: 'pur_id_1',
  pickupCancelRequestId: '',
  labelSize: 'std',
  labelLrn: '220041149',
  lrCopyLrn: '123456789',
  lrCopyType: '',
  lrCopyRequestId: '',
  documentDocType: 'shipping_label',
  documentLrns: '220040156,220040143',
  documentSize: 'a4',
  documentLrCopyTypes: '',
  documentCallbackUri: 'https://btob-api-dev.delhivery.com/v3/document/generate_label_pdf',
  documentCallbackMethod: 'POST',
  documentCallbackAuthorization: 'Bearer Token',
  documentRequestId: '',
  documentJobId: '',
  documentStatusRequestId: '',
}

const CourierCredentials = () => {
  const toast = useToast()
  const { data, isLoading, error } = useCourierCredentials()
  const updateDelhivery = useUpdateDelhiveryCredentials()
  const forgotPasswordMutation = useDelhiveryForgotPassword()
  const b2bLoginMutation = useDelhiveryB2BLogin()
  const b2bLogoutMutation = useDelhiveryB2BLogout()
  const b2bServiceabilityMutation = useDelhiveryB2BServiceability()
  const b2bTatMutation = useDelhiveryB2BTat()
  const b2bFreightEstimateMutation = useDelhiveryB2BFreightEstimate()
  const b2bFreightChargesMutation = useDelhiveryB2BFreightCharges()
  const b2bClientWarehouseCreateMutation = useDelhiveryB2BClientWarehouseCreate()
  const b2bClientWarehouseUpdateMutation = useDelhiveryB2BClientWarehouseUpdate()
  const b2bShipmentCreateMutation = useDelhiveryB2BShipmentCreate()
  const b2bShipmentStatusMutation = useDelhiveryB2BShipmentStatus()
  const b2bShipmentUpdateMutation = useDelhiveryB2BShipmentUpdate()
  const b2bShipmentUpdateStatusMutation = useDelhiveryB2BShipmentUpdateStatus()
  const b2bShipmentCancelMutation = useDelhiveryB2BShipmentCancel()
  const b2bShipmentTrackMutation = useDelhiveryB2BShipmentTrack()
  const b2bAppointmentBookMutation = useDelhiveryB2BAppointmentBook()
  const b2bPickupRequestCreateMutation = useDelhiveryB2BPickupRequestCreate()
  const b2bPickupRequestCancelMutation = useDelhiveryB2BPickupRequestCancel()
  const b2bLabelUrlsMutation = useDelhiveryB2BLabelUrls()
  const b2bLrCopyMutation = useDelhiveryB2BLrCopy()
  const b2bDocumentGenerateMutation = useDelhiveryB2BDocumentGenerate()
  const b2bDocumentStatusMutation = useDelhiveryB2BDocumentStatus()
  const [accounts, setAccounts] = useState(() => normalizeAccounts([]))
  const [b2bTestInputs, setB2BTestInputs] = useState(DEFAULT_B2B_TEST_INPUTS)

  useEffect(() => {
    setAccounts(normalizeAccounts(data?.delhivery?.accounts))
  }, [data])

  const delhiveryWebhookConfig = data?.delhivery?.webhookConfig || {}

  const accountSummary = useMemo(
    () => ({
      configured: accounts.filter((account) => account.hasApiKey || account.apiKey).length,
      active: accounts.filter((account) => account.isActive).length,
    }),
    [accounts],
  )

  const handleCopyWebhookUrl = async (value, label) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      toast({ title: `${label} copied`, status: 'success' })
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast({ title: `${label} copied`, status: 'success' })
    }
  }

  const updateAccount = (index, patch) => {
    setAccounts((current) =>
      current.map((account, accountIndex) => {
        if (accountIndex !== index) return account
        return { ...account, ...patch }
      }),
    )
  }

  const handleToggleDefault = (index) => {
    setAccounts((current) =>
      current.map((account, accountIndex) => ({
        ...account,
        isDefault: accountIndex === index,
        isActive: accountIndex === index ? true : account.isActive,
      })),
    )
  }

  const handleSave = () => {
    updateDelhivery.mutate(
      {
        accounts: accounts.map((account) => ({
          accountCode: account.accountCode,
          accountLabel: account.accountLabel,
          apiBase: account.apiBase,
          clientName: account.clientName,
          apiKey: account.apiKey,
          username: account.username,
          password: account.password,
          isActive: account.isActive,
          isDefault: account.isDefault,
          pickupLocationIds: normalizeArrayInput(account.pickupLocationIds),
          pickupLocationNames: normalizeArrayInput(account.pickupLocationNames),
        })),
      },
      {
        onSuccess: (saved) => {
          toast({
            title: 'Delhivery accounts updated',
            status: 'success',
          })
          setAccounts(normalizeAccounts(saved?.accounts))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Delhivery accounts',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleForgotPassword = (account) => {
    forgotPasswordMutation.mutate(
      {
        accountCode: account.accountCode,
        username: account.username,
        apiBase: account.apiBase,
      },
      {
        onSuccess: (response) => {
          toast({
            title: 'Delhivery password reset request submitted',
            description: response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'Failed to submit Delhivery password reset request',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleB2BLogin = (account) => {
    b2bLoginMutation.mutate(
      {
        accountCode: account.accountCode,
        username: account.username,
        password: account.password,
        apiBase: account.apiBase,
      },
      {
        onSuccess: (response) => {
          toast({
            title: 'Delhivery B2B login successful',
            description: response?.data?.expiresAt
              ? `Token valid until ${new Date(response.data.expiresAt).toLocaleString()}`
              : response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'Delhivery B2B login failed',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const updateB2BTestInput = (key, value) => {
    setB2BTestInputs((current) => ({ ...current, [key]: value }))
  }

  const handleB2BAction = (mutation, payload, labels) => {
    mutation.mutate(payload, {
      onSuccess: (response) => {
        toast({
          title: labels.success,
          description: response?.data?.status ? `Provider status ${response.data.status}` : response?.message,
          status: 'success',
        })
      },
      onError: (err) => {
        toast({
          title: labels.error,
          description: err?.message,
          status: 'error',
        })
      },
    })
  }

  const buildB2BAccountPayload = (account) => ({
    accountCode: account.accountCode,
    apiBase: account.apiBase,
  })

  const buildFreightEstimatePayload = (account) => ({
    ...buildB2BAccountPayload(account),
    dimensions: [
      {
        length_cm: Number(b2bTestInputs.freightLengthCm),
        width_cm: Number(b2bTestInputs.freightWidthCm),
        height_cm: Number(b2bTestInputs.freightHeightCm),
        box_count: Number(b2bTestInputs.freightBoxCount),
      },
    ],
    weight_g: Number(b2bTestInputs.freightWeightG),
    cheque_payment: false,
    source_pin: b2bTestInputs.freightSourcePin,
    consignee_pin: b2bTestInputs.freightConsigneePin,
    payment_mode: b2bTestInputs.freightPaymentMode,
    ...(b2bTestInputs.freightPaymentMode === 'cod'
      ? { cod_amount: Number(b2bTestInputs.freightCodAmount || 0) }
      : {}),
    inv_amount: Number(b2bTestInputs.freightInvAmount),
    freight_mode: b2bTestInputs.freightMode,
    rov_insurance: b2bTestInputs.freightRovInsurance,
  })

  const buildClientWarehousePayload = (account) => {
    const businessDay = String(b2bTestInputs.warehouseBusinessDay || 'TUE').trim().toUpperCase()

    return {
      ...buildB2BAccountPayload(account),
      pin_code: b2bTestInputs.warehousePinCode,
      city: b2bTestInputs.warehouseCity,
      state: b2bTestInputs.warehouseState,
      country: b2bTestInputs.warehouseCountry,
      name: b2bTestInputs.warehouseName,
      address_details: {
        address: b2bTestInputs.warehouseAddress,
        contact_person: b2bTestInputs.warehouseContactPerson,
        phone_number: b2bTestInputs.warehousePhoneNumber,
      },
      business_hours: {
        [businessDay]: {
          start_time: b2bTestInputs.warehouseBusinessStart,
          close_time: b2bTestInputs.warehouseBusinessClose,
        },
      },
      pick_up_hours: {
        [businessDay]: {
          start_time: b2bTestInputs.warehousePickupStart,
          close_time: b2bTestInputs.warehousePickupClose,
        },
      },
      pick_up_days: [businessDay],
      business_days: [businessDay],
      ...(b2bTestInputs.warehouseSameAsForwardAddress
        ? { same_as_fwd_add: true }
        : {
            ret_address: {
              pin: b2bTestInputs.warehouseReturnPin,
              address: b2bTestInputs.warehouseReturnAddress,
            },
      }),
    }
  }

  const buildClientWarehouseUpdatePayload = (account) => {
    const businessDay = String(b2bTestInputs.warehouseBusinessDay || 'TUE').trim().toUpperCase()

    return {
      ...buildB2BAccountPayload(account),
      cl_warehouse_name: b2bTestInputs.warehouseName,
      update_dict: {
        city: b2bTestInputs.warehouseCity,
        state: b2bTestInputs.warehouseState,
        country: b2bTestInputs.warehouseCountry,
        address_details: {
          address: b2bTestInputs.warehouseAddress,
          contact_person: b2bTestInputs.warehouseContactPerson,
          phone_number: b2bTestInputs.warehousePhoneNumber,
        },
        buisness_hours: {
          [businessDay]: {
            start_time: b2bTestInputs.warehouseBusinessStart,
            close_time: b2bTestInputs.warehouseBusinessClose,
          },
        },
        ...(b2bTestInputs.warehouseSameAsForwardAddress
          ? {}
          : {
              ret_address: {
                address: b2bTestInputs.warehouseReturnAddress,
                city: b2bTestInputs.warehouseCity,
                state: b2bTestInputs.warehouseState,
                pin: b2bTestInputs.warehouseReturnPin,
                country: b2bTestInputs.warehouseCountry,
              },
            }),
      },
    }
  }

  const buildShipmentPayload = (account) => ({
    ...buildB2BAccountPayload(account),
    ...JSON.parse(b2bTestInputs.shipmentPayloadText),
  })

  const handleShipmentCreate = (account) => {
    try {
      const payload = buildShipmentPayload(account)
      b2bShipmentCreateMutation.mutate(payload, {
        onSuccess: (response) => {
          const nextJobId = String(response?.data?.jobId || '').trim()
          if (nextJobId) {
            updateB2BTestInput('shipmentJobId', nextJobId)
          }
          toast({
            title: 'Delhivery B2B shipment creation submitted',
            description: nextJobId
              ? `Job ID ${nextJobId}`
              : response?.data?.status
                ? `Provider status ${response.data.status}`
                : response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'Delhivery B2B shipment creation failed',
            description: err?.message,
            status: 'error',
          })
        },
      })
    } catch (err) {
      toast({
        title: 'Invalid shipment payload JSON',
        description: err?.message,
        status: 'error',
      })
    }
  }

  const handleShipmentStatus = (account) => {
    handleB2BAction(
      b2bShipmentStatusMutation,
      {
        ...buildB2BAccountPayload(account),
        jobId: b2bTestInputs.shipmentJobId,
      },
      {
        success: 'Delhivery B2B shipment status fetched',
        error: 'Delhivery B2B shipment status failed',
      },
    )
  }

  const handleShipmentUpdate = (account) => {
    try {
      const payload = {
        ...buildB2BAccountPayload(account),
        lrn: b2bTestInputs.shipmentUpdateLrn,
        ...JSON.parse(b2bTestInputs.shipmentUpdatePayloadText),
      }
      b2bShipmentUpdateMutation.mutate(payload, {
        onSuccess: (response) => {
          const nextJobId = String(response?.data?.jobId || '').trim()
          if (nextJobId) {
            updateB2BTestInput('shipmentUpdateJobId', nextJobId)
          }
          toast({
            title: 'Delhivery B2B shipment update submitted',
            description: nextJobId
              ? `Job ID ${nextJobId}`
              : response?.data?.status
                ? `Provider status ${response.data.status}`
                : response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'Delhivery B2B shipment update failed',
            description: err?.message,
            status: 'error',
          })
        },
      })
    } catch (err) {
      toast({
        title: 'Invalid shipment update payload JSON',
        description: err?.message,
        status: 'error',
      })
    }
  }

  const handleShipmentUpdateStatus = (account) => {
    handleB2BAction(
      b2bShipmentUpdateStatusMutation,
      {
        ...buildB2BAccountPayload(account),
        jobId: b2bTestInputs.shipmentUpdateJobId,
      },
      {
        success: 'Delhivery B2B shipment update status fetched',
        error: 'Delhivery B2B shipment update status failed',
      },
    )
  }

  const handleShipmentCancel = (account) => {
    handleB2BAction(
      b2bShipmentCancelMutation,
      {
        ...buildB2BAccountPayload(account),
        lrn: b2bTestInputs.shipmentCancelLrn,
      },
      {
        success: 'Delhivery B2B shipment cancelled',
        error: 'Delhivery B2B shipment cancellation failed',
      },
    )
  }

  const handleShipmentTrack = (account) => {
    handleB2BAction(
      b2bShipmentTrackMutation,
      {
        ...buildB2BAccountPayload(account),
        lrn: b2bTestInputs.shipmentTrackLrn,
        allWbns: b2bTestInputs.shipmentTrackAllWbns,
      },
      {
        success: 'Delhivery B2B shipment tracking fetched',
        error: 'Delhivery B2B shipment tracking failed',
      },
    )
  }

  const handleAppointmentBooking = (account) => {
    const poNumbers = normalizeArrayInput(b2bTestInputs.appointmentPoNumbers).slice(0, 5)
    handleB2BAction(
      b2bAppointmentBookMutation,
      {
        ...buildB2BAccountPayload(account),
        lrn: b2bTestInputs.appointmentLrn,
        date: b2bTestInputs.appointmentDate,
        appointment_slot: b2bTestInputs.appointmentSlot,
        po_number: poNumbers.length ? poNumbers : ['NotApplicable'],
        ...(String(b2bTestInputs.appointmentId || '').trim()
          ? { appointment_id: String(b2bTestInputs.appointmentId || '').trim() }
          : {}),
        po_expiry_date: b2bTestInputs.appointmentPoExpiryDate,
      },
      {
        success: 'Delhivery B2B appointment booked',
        error: 'Delhivery B2B appointment booking failed',
      },
    )
  }

  const handlePickupRequestCreate = (account) => {
    handleB2BAction(
      b2bPickupRequestCreateMutation,
      {
        ...buildB2BAccountPayload(account),
        client_warehouse: b2bTestInputs.pickupRequestWarehouse,
        pickup_date: b2bTestInputs.pickupRequestDate,
        start_time: b2bTestInputs.pickupRequestStartTime,
        expected_package_count: Number(b2bTestInputs.pickupRequestExpectedPackageCount || 0),
        ...(String(b2bTestInputs.pickupRequestId || '').trim()
          ? { requestId: String(b2bTestInputs.pickupRequestId || '').trim() }
          : {}),
      },
      {
        success: 'Delhivery B2B pickup request created',
        error: 'Delhivery B2B pickup request failed',
      },
    )
  }

  const handlePickupRequestCancel = (account) => {
    handleB2BAction(
      b2bPickupRequestCancelMutation,
      {
        ...buildB2BAccountPayload(account),
        pickupId: b2bTestInputs.pickupCancelId,
        ...(String(b2bTestInputs.pickupCancelRequestId || '').trim()
          ? { requestId: String(b2bTestInputs.pickupCancelRequestId || '').trim() }
          : {}),
      },
      {
        success: 'Delhivery B2B pickup request cancelled',
        error: 'Delhivery B2B pickup request cancellation failed',
      },
    )
  }

  const handleLabelUrls = (account) => {
    handleB2BAction(
      b2bLabelUrlsMutation,
      {
        ...buildB2BAccountPayload(account),
        size: b2bTestInputs.labelSize,
        lrn: b2bTestInputs.labelLrn,
      },
      {
        success: 'Delhivery B2B label URLs fetched',
        error: 'Delhivery B2B label URL fetch failed',
      },
    )
  }

  const handleLrCopy = (account) => {
    b2bLrCopyMutation.mutate(
      {
        ...buildB2BAccountPayload(account),
        lrn: b2bTestInputs.lrCopyLrn,
        ...(String(b2bTestInputs.lrCopyType || '').trim()
          ? { lrCopyType: String(b2bTestInputs.lrCopyType || '').trim() }
          : {}),
        ...(String(b2bTestInputs.lrCopyRequestId || '').trim()
          ? { requestId: String(b2bTestInputs.lrCopyRequestId || '').trim() }
          : {}),
      },
      {
        onSuccess: (response) => {
          const providerResponse = response?.data?.providerResponse || {}
          const pdfBase64 = String(providerResponse?.pdfBase64 || '').trim()
          const fileName = String(providerResponse?.fileName || `delhivery-lr-copy-${b2bTestInputs.lrCopyLrn}.pdf`).trim()
          const contentType = String(providerResponse?.contentType || 'application/pdf').trim()

          if (pdfBase64) {
            const binary = window.atob(pdfBase64)
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
            const blob = new Blob([bytes], { type: contentType })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
          }

          toast({
            title: 'Delhivery B2B LR copy fetched',
            description: pdfBase64 ? `Downloaded ${fileName}` : response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'Delhivery B2B LR copy failed',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleDocumentGenerate = (account) => {
    const lrns = normalizeArrayInput(b2bTestInputs.documentLrns).slice(0, 25)
    const lrCopyTypes = normalizeArrayInput(b2bTestInputs.documentLrCopyTypes)
    const docType = String(b2bTestInputs.documentDocType || '').trim()

    b2bDocumentGenerateMutation.mutate(
      {
        ...buildB2BAccountPayload(account),
        docType,
        lrns,
        ...(docType === 'shipping_label'
          ? { size: String(b2bTestInputs.documentSize || '').trim() }
          : {}),
        ...(docType === 'lr_copy' && lrCopyTypes.length ? { lr_copy_type: lrCopyTypes } : {}),
        callback: {
          uri: b2bTestInputs.documentCallbackUri,
          method: b2bTestInputs.documentCallbackMethod,
          authorization: b2bTestInputs.documentCallbackAuthorization,
        },
        ...(String(b2bTestInputs.documentRequestId || '').trim()
          ? { requestId: String(b2bTestInputs.documentRequestId || '').trim() }
          : {}),
      },
      {
        onSuccess: (response) => {
          const nextJobId = String(response?.data?.jobId || '').trim()
          if (nextJobId) {
            updateB2BTestInput('documentJobId', nextJobId)
          }
          toast({
            title: 'Delhivery B2B document generation submitted',
            description: nextJobId
              ? `Job ID ${nextJobId}`
              : response?.data?.status
                ? `Provider status ${response.data.status}`
                : response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'Delhivery B2B document generation failed',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleDocumentStatus = (account) => {
    handleB2BAction(
      b2bDocumentStatusMutation,
      {
        ...buildB2BAccountPayload(account),
        docType: b2bTestInputs.documentDocType,
        jobId: b2bTestInputs.documentJobId,
        ...(String(b2bTestInputs.documentStatusRequestId || '').trim()
          ? { requestId: String(b2bTestInputs.documentStatusRequestId || '').trim() }
          : {}),
      },
      {
        success: 'Delhivery B2B document status fetched',
        error: 'Delhivery B2B document status failed',
      },
    )
  }

  if (isLoading) return <Spinner size="md" />

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={5}>
      {error && (
        <Alert status="warning" borderRadius="lg">
          <AlertIcon />
          <AlertDescription>
            Delhivery credentials could not be loaded from the API, so blank fallback cards are
            shown. You can still save fresh account details from here.
          </AlertDescription>
        </Alert>
      )}

      <Stack spacing={1}>
        <Text fontSize="xl" fontWeight="bold">
          Delhivery Accounts
        </Text>
        <Text color="gray.500">
          Configure Delhivery B2C, B2B, and optional backup credentials, then map pickup
          locations to the right account.
        </Text>
      </Stack>

      <Flex gap={3} wrap="wrap">
        <Badge colorScheme="green" px={3} py={1} borderRadius="full">
          {accountSummary.configured} configured
        </Badge>
        <Badge colorScheme="blue" px={3} py={1} borderRadius="full">
          {accountSummary.active} active
        </Badge>
      </Flex>

      <Box borderWidth="1px" borderRadius="lg" p={5}>
        <VStack spacing={4} align="stretch">
          <Text fontWeight="semibold">Webhook Setup</Text>

          <FormControl>
            <FormLabel>Scan Push Webhook URL</FormLabel>
            <Flex gap={2}>
              <Input value={delhiveryWebhookConfig.scanPushUrl || ''} isReadOnly fontSize="sm" />
              <Button
                size="sm"
                leftIcon={<CopyIcon />}
                onClick={() =>
                  handleCopyWebhookUrl(
                    delhiveryWebhookConfig.scanPushUrl,
                    'Scan push webhook URL',
                  )
                }
                isDisabled={!delhiveryWebhookConfig.scanPushUrl}
              >
                Copy
              </Button>
            </Flex>
          </FormControl>

          <FormControl>
            <FormLabel>Document Push Webhook URL</FormLabel>
            <Flex gap={2}>
              <Input
                value={delhiveryWebhookConfig.documentPushUrl || ''}
                isReadOnly
                fontSize="sm"
              />
              <Button
                size="sm"
                leftIcon={<CopyIcon />}
                onClick={() =>
                  handleCopyWebhookUrl(
                    delhiveryWebhookConfig.documentPushUrl,
                    'Document push webhook URL',
                  )
                }
                isDisabled={!delhiveryWebhookConfig.documentPushUrl}
              >
                Copy
              </Button>
            </Flex>
          </FormControl>

          <Text fontSize="sm" color="gray.500">
            Orders stay visible to merchants as Delhivery. The backend picks an account using pickup
            location mappings, then falls back to the default active account.
          </Text>
        </VStack>
      </Box>

      <Grid templateColumns={{ base: '1fr', xl: 'repeat(3, 1fr)' }} gap={4}>
        {accounts.map((account, index) => (
          <GridItem key={account.accountCode}>
            <Box borderWidth="1px" borderRadius="lg" p={5} h="100%">
              <VStack spacing={4} align="stretch" h="100%">
                <Flex justify="space-between" align="center">
                  <Stack spacing={0}>
                    <Text fontWeight="semibold">
                      {ACCOUNT_PRESETS[index]?.title || `Account ${index + 1}`}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      {account.accountCode}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {ACCOUNT_PRESETS[index]?.description || 'Delhivery account configuration'}
                    </Text>
                  </Stack>
                  <Badge
                    colorScheme={account.hasApiKey || account.apiKey ? 'green' : 'orange'}
                  >
                    {account.hasApiKey || account.apiKey ? 'Configured' : 'Missing API key'}
                  </Badge>
                </Flex>

                <FormControl>
                  <FormLabel>Account Label</FormLabel>
                  <Input
                    value={account.accountLabel}
                    onChange={(e) => updateAccount(index, { accountLabel: e.target.value })}
                    placeholder={
                      ACCOUNT_PRESETS[index]?.defaultLabel || `Delhivery Account ${index + 1}`
                    }
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>API Base URL</FormLabel>
                  <Input
                    value={account.apiBase}
                    onChange={(e) => updateAccount(index, { apiBase: e.target.value })}
                    placeholder="https://track.delhivery.com"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Client Name</FormLabel>
                  <Input
                    value={account.clientName}
                    onChange={(e) => updateAccount(index, { clientName: e.target.value })}
                    placeholder="Registered Delhivery client name"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>API Key</FormLabel>
                  <Input
                    type="password"
                    value={account.apiKey}
                    onChange={(e) => updateAccount(index, { apiKey: e.target.value })}
                    placeholder={account.apiKeyMasked || 'Enter Delhivery API key'}
                  />
                  {!!account.apiKeyMasked && !account.apiKey && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Current key: {account.apiKeyMasked}
                    </Text>
                  )}
                </FormControl>

                {index === 1 && (
                  <>
                    <FormControl>
                      <FormLabel>B2B Username</FormLabel>
                      <Input
                        value={account.username || ''}
                        onChange={(e) => updateAccount(index, { username: e.target.value })}
                        placeholder="Registered Delhivery username without spaces"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>B2B Password</FormLabel>
                      <Input
                        type="password"
                        value={account.password || ''}
                        onChange={(e) => updateAccount(index, { password: e.target.value })}
                        placeholder={account.passwordMasked || 'Enter Delhivery B2B password'}
                      />
                      {!!account.passwordMasked && !account.password && (
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          A saved B2B password already exists.
                        </Text>
                      )}
                    </FormControl>

                    <Flex gap={2} wrap="wrap">
                      <Badge colorScheme={account.hasB2BAuthToken ? 'green' : 'gray'}>
                        {account.hasB2BAuthToken ? 'B2B token cached' : 'No B2B token'}
                      </Badge>
                      {!!account.b2bAuthTokenExpiresAt && (
                        <Badge colorScheme="blue">
                          Expires {new Date(account.b2bAuthTokenExpiresAt).toLocaleString()}
                        </Badge>
                      )}
                    </Flex>

                    <Button
                      colorScheme="blue"
                      variant="outline"
                      onClick={() => handleB2BLogin(account)}
                      isLoading={
                        b2bLoginMutation.isPending &&
                        b2bLoginMutation.variables?.accountCode === account.accountCode
                      }
                      isDisabled={
                        !String(account.username || '').trim() ||
                        (!String(account.password || '').trim() && !account.hasPassword)
                      }
                    >
                      Test Delhivery B2B Login
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() =>
                        handleB2BAction(
                          b2bLogoutMutation,
                          buildB2BAccountPayload(account),
                          {
                            success: 'Delhivery B2B logout successful',
                            error: 'Delhivery B2B logout failed',
                          },
                        )
                      }
                      isLoading={b2bLogoutMutation.isPending}
                      isDisabled={!account.hasB2BAuthToken}
                    >
                      Logout Delhivery B2B Token
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleForgotPassword(account)}
                      isLoading={
                        forgotPasswordMutation.isPending &&
                        forgotPasswordMutation.variables?.accountCode === account.accountCode
                      }
                      isDisabled={!String(account.username || '').trim()}
                    >
                      Reset Delhivery B2B Password
                    </Button>

                    <Text fontSize="xs" color="gray.500">
                      This triggers Delhivery&apos;s forgot-password API for the saved B2B username.
                    </Text>

                    <Stack spacing={3} borderTopWidth="1px" pt={4}>
                      <Text fontWeight="semibold" fontSize="sm">
                        B2B Endpoint Tests
                      </Text>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Serviceability Pincode</FormLabel>
                          <Input
                            value={b2bTestInputs.serviceabilityPincode}
                            onChange={(e) =>
                              updateB2BTestInput('serviceabilityPincode', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Weight</FormLabel>
                          <Input
                            value={b2bTestInputs.serviceabilityWeight}
                            onChange={(e) =>
                              updateB2BTestInput('serviceabilityWeight', e.target.value)
                            }
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() =>
                          handleB2BAction(
                            b2bServiceabilityMutation,
                            {
                              ...buildB2BAccountPayload(account),
                              pincode: b2bTestInputs.serviceabilityPincode,
                              weight: b2bTestInputs.serviceabilityWeight,
                            },
                            {
                              success: 'Delhivery B2B serviceability fetched',
                              error: 'Delhivery B2B serviceability failed',
                            },
                          )
                        }
                        isLoading={b2bServiceabilityMutation.isPending}
                        isDisabled={!account.hasB2BAuthToken}
                      >
                        Test Serviceability
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>TAT Origin Pin</FormLabel>
                          <Input
                            value={b2bTestInputs.tatOriginPin}
                            onChange={(e) => updateB2BTestInput('tatOriginPin', e.target.value)}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>TAT Destination Pin</FormLabel>
                          <Input
                            value={b2bTestInputs.tatDestinationPin}
                            onChange={(e) =>
                              updateB2BTestInput('tatDestinationPin', e.target.value)
                            }
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() =>
                          handleB2BAction(
                            b2bTatMutation,
                            {
                              ...buildB2BAccountPayload(account),
                              originPin: b2bTestInputs.tatOriginPin,
                              destinationPin: b2bTestInputs.tatDestinationPin,
                            },
                            {
                              success: 'Delhivery B2B TAT fetched',
                              error: 'Delhivery B2B TAT failed',
                            },
                          )
                        }
                        isLoading={b2bTatMutation.isPending}
                        isDisabled={!account.hasB2BAuthToken}
                      >
                        Test Expected TAT
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Freight Source Pin</FormLabel>
                          <Input
                            value={b2bTestInputs.freightSourcePin}
                            onChange={(e) =>
                              updateB2BTestInput('freightSourcePin', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Freight Consignee Pin</FormLabel>
                          <Input
                            value={b2bTestInputs.freightConsigneePin}
                            onChange={(e) =>
                              updateB2BTestInput('freightConsigneePin', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Weight Grams</FormLabel>
                          <Input
                            value={b2bTestInputs.freightWeightG}
                            onChange={(e) => updateB2BTestInput('freightWeightG', e.target.value)}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Invoice Amount</FormLabel>
                          <Input
                            value={b2bTestInputs.freightInvAmount}
                            onChange={(e) =>
                              updateB2BTestInput('freightInvAmount', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Length CM</FormLabel>
                          <Input
                            value={b2bTestInputs.freightLengthCm}
                            onChange={(e) =>
                              updateB2BTestInput('freightLengthCm', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Width CM</FormLabel>
                          <Input
                            value={b2bTestInputs.freightWidthCm}
                            onChange={(e) =>
                              updateB2BTestInput('freightWidthCm', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Height CM</FormLabel>
                          <Input
                            value={b2bTestInputs.freightHeightCm}
                            onChange={(e) =>
                              updateB2BTestInput('freightHeightCm', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Box Count</FormLabel>
                          <Input
                            value={b2bTestInputs.freightBoxCount}
                            onChange={(e) =>
                              updateB2BTestInput('freightBoxCount', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Payment Mode</FormLabel>
                          <Input
                            value={b2bTestInputs.freightPaymentMode}
                            onChange={(e) =>
                              updateB2BTestInput('freightPaymentMode', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Freight Mode</FormLabel>
                          <Input
                            value={b2bTestInputs.freightMode}
                            onChange={(e) => updateB2BTestInput('freightMode', e.target.value)}
                          />
                        </FormControl>
                      </Grid>

                      <Flex align="center" justify="space-between">
                        <Text fontSize="sm">ROV insurance</Text>
                        <Switch
                          isChecked={b2bTestInputs.freightRovInsurance}
                          onChange={(e) =>
                            updateB2BTestInput('freightRovInsurance', e.target.checked)
                          }
                        />
                      </Flex>

                      <Button
                        variant="outline"
                        onClick={() =>
                          handleB2BAction(
                            b2bFreightEstimateMutation,
                            buildFreightEstimatePayload(account),
                            {
                              success: 'Delhivery B2B freight estimate fetched',
                              error: 'Delhivery B2B freight estimate failed',
                            },
                          )
                        }
                        isLoading={b2bFreightEstimateMutation.isPending}
                        isDisabled={!account.hasB2BAuthToken}
                      >
                        Test Freight Estimator
                      </Button>

                      <FormControl>
                        <FormLabel>LRNs</FormLabel>
                        <Textarea
                          rows={3}
                          value={b2bTestInputs.freightChargesLrns}
                          onChange={(e) =>
                            updateB2BTestInput('freightChargesLrns', e.target.value)
                          }
                          placeholder="Comma separated LRNs"
                        />
                      </FormControl>

                      <Button
                        variant="outline"
                        onClick={() =>
                          handleB2BAction(
                            b2bFreightChargesMutation,
                            {
                              ...buildB2BAccountPayload(account),
                              lrns: b2bTestInputs.freightChargesLrns,
                            },
                            {
                              success: 'Delhivery B2B freight charges fetched',
                              error: 'Delhivery B2B freight charges failed',
                            },
                          )
                        }
                        isLoading={b2bFreightChargesMutation.isPending}
                        isDisabled={!account.hasB2BAuthToken}
                      >
                        Test Freight Charges
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Warehouse Name</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseName}
                            onChange={(e) => updateB2BTestInput('warehouseName', e.target.value)}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Warehouse Pin Code</FormLabel>
                          <Input
                            value={b2bTestInputs.warehousePinCode}
                            onChange={(e) =>
                              updateB2BTestInput('warehousePinCode', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Warehouse City</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseCity}
                            onChange={(e) => updateB2BTestInput('warehouseCity', e.target.value)}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Warehouse State</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseState}
                            onChange={(e) => updateB2BTestInput('warehouseState', e.target.value)}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Warehouse Country</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseCountry}
                            onChange={(e) =>
                              updateB2BTestInput('warehouseCountry', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Contact Person</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseContactPerson}
                            onChange={(e) =>
                              updateB2BTestInput('warehouseContactPerson', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Phone Number</FormLabel>
                          <Input
                            value={b2bTestInputs.warehousePhoneNumber}
                            onChange={(e) =>
                              updateB2BTestInput('warehousePhoneNumber', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Business Day</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseBusinessDay}
                            onChange={(e) =>
                              updateB2BTestInput('warehouseBusinessDay', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Business Start</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseBusinessStart}
                            onChange={(e) =>
                              updateB2BTestInput('warehouseBusinessStart', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Business Close</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseBusinessClose}
                            onChange={(e) =>
                              updateB2BTestInput('warehouseBusinessClose', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Pickup Start</FormLabel>
                          <Input
                            value={b2bTestInputs.warehousePickupStart}
                            onChange={(e) =>
                              updateB2BTestInput('warehousePickupStart', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Pickup Close</FormLabel>
                          <Input
                            value={b2bTestInputs.warehousePickupClose}
                            onChange={(e) =>
                              updateB2BTestInput('warehousePickupClose', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>Warehouse Address</FormLabel>
                          <Textarea
                            rows={2}
                            value={b2bTestInputs.warehouseAddress}
                            onChange={(e) =>
                              updateB2BTestInput('warehouseAddress', e.target.value)
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Return Pin</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseReturnPin}
                            onChange={(e) =>
                              updateB2BTestInput('warehouseReturnPin', e.target.value)
                            }
                            isDisabled={b2bTestInputs.warehouseSameAsForwardAddress}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Return Address</FormLabel>
                          <Input
                            value={b2bTestInputs.warehouseReturnAddress}
                            onChange={(e) =>
                              updateB2BTestInput('warehouseReturnAddress', e.target.value)
                            }
                            isDisabled={b2bTestInputs.warehouseSameAsForwardAddress}
                          />
                        </FormControl>
                      </Grid>

                      <Flex align="center" justify="space-between">
                        <Text fontSize="sm">Return address same as forward</Text>
                        <Switch
                          isChecked={b2bTestInputs.warehouseSameAsForwardAddress}
                          onChange={(e) =>
                            updateB2BTestInput(
                              'warehouseSameAsForwardAddress',
                              e.target.checked,
                            )
                          }
                        />
                      </Flex>

                      <Button
                        variant="outline"
                        onClick={() =>
                          handleB2BAction(
                            b2bClientWarehouseCreateMutation,
                            buildClientWarehousePayload(account),
                            {
                              success: 'Delhivery B2B client warehouse created',
                              error: 'Delhivery B2B client warehouse creation failed',
                            },
                          )
                        }
                        isLoading={b2bClientWarehouseCreateMutation.isPending}
                        isDisabled={!account.hasB2BAuthToken}
                      >
                        Create Client Warehouse
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() =>
                          handleB2BAction(
                            b2bClientWarehouseUpdateMutation,
                            buildClientWarehouseUpdatePayload(account),
                            {
                              success: 'Delhivery B2B client warehouse updated',
                              error: 'Delhivery B2B client warehouse update failed',
                            },
                          )
                        }
                        isLoading={b2bClientWarehouseUpdateMutation.isPending}
                        isDisabled={!account.hasB2BAuthToken}
                      >
                        Update Client Warehouse
                      </Button>

                      <FormControl>
                        <FormLabel>Shipment Creation Payload</FormLabel>
                        <Textarea
                          rows={16}
                          value={b2bTestInputs.shipmentPayloadText}
                          onChange={(e) =>
                            updateB2BTestInput('shipmentPayloadText', e.target.value)
                          }
                          placeholder="Paste Delhivery B2B manifest payload JSON"
                        />
                      </FormControl>

                      <Button
                        variant="outline"
                        onClick={() => handleShipmentCreate(account)}
                        isLoading={b2bShipmentCreateMutation.isPending}
                        isDisabled={!account.hasB2BAuthToken}
                      >
                        Create B2B Shipment
                      </Button>

                      <FormControl>
                        <FormLabel>Shipment Job ID</FormLabel>
                        <Input
                          value={b2bTestInputs.shipmentJobId}
                          onChange={(e) => updateB2BTestInput('shipmentJobId', e.target.value)}
                          placeholder="job_id / request_id from shipment creation"
                        />
                      </FormControl>

                      <Button
                        variant="outline"
                        onClick={() => handleShipmentStatus(account)}
                        isLoading={b2bShipmentStatusMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken || !String(b2bTestInputs.shipmentJobId || '').trim()
                        }
                      >
                        Check Shipment Creation Status
                      </Button>

                      <FormControl>
                        <FormLabel>Shipment Update LRN</FormLabel>
                        <Input
                          value={b2bTestInputs.shipmentUpdateLrn}
                          onChange={(e) => updateB2BTestInput('shipmentUpdateLrn', e.target.value)}
                          placeholder="Manifested LRN to update"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Shipment Update Payload</FormLabel>
                        <Textarea
                          rows={14}
                          value={b2bTestInputs.shipmentUpdatePayloadText}
                          onChange={(e) =>
                            updateB2BTestInput('shipmentUpdatePayloadText', e.target.value)
                          }
                          placeholder="Paste Delhivery B2B shipment update payload JSON"
                        />
                      </FormControl>

                      <Button
                        variant="outline"
                        onClick={() => handleShipmentUpdate(account)}
                        isLoading={b2bShipmentUpdateMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.shipmentUpdateLrn || '').trim()
                        }
                      >
                        Update Manifested Shipment
                      </Button>

                      <FormControl>
                        <FormLabel>Shipment Update Job ID</FormLabel>
                        <Input
                          value={b2bTestInputs.shipmentUpdateJobId}
                          onChange={(e) =>
                            updateB2BTestInput('shipmentUpdateJobId', e.target.value)
                          }
                          placeholder="job_id returned from shipment update"
                        />
                      </FormControl>

                      <Button
                        variant="outline"
                        onClick={() => handleShipmentUpdateStatus(account)}
                        isLoading={b2bShipmentUpdateStatusMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.shipmentUpdateJobId || '').trim()
                        }
                      >
                        Check Shipment Update Status
                      </Button>

                      <FormControl>
                        <FormLabel>Shipment Cancel LRN</FormLabel>
                        <Input
                          value={b2bTestInputs.shipmentCancelLrn}
                          onChange={(e) => updateB2BTestInput('shipmentCancelLrn', e.target.value)}
                          placeholder="Manifested LRN to cancel"
                        />
                      </FormControl>

                      <Button
                        variant="outline"
                        onClick={() => handleShipmentCancel(account)}
                        isLoading={b2bShipmentCancelMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.shipmentCancelLrn || '').trim()
                        }
                      >
                        Cancel Shipment
                      </Button>

                      <FormControl>
                        <FormLabel>Shipment Track LRN</FormLabel>
                        <Input
                          value={b2bTestInputs.shipmentTrackLrn}
                          onChange={(e) => updateB2BTestInput('shipmentTrackLrn', e.target.value)}
                          placeholder="Manifested LRN to track"
                        />
                      </FormControl>

                      <Flex align="center" justify="space-between">
                        <Text fontSize="sm">Track all child waybills</Text>
                        <Switch
                          isChecked={b2bTestInputs.shipmentTrackAllWbns}
                          onChange={(e) =>
                            updateB2BTestInput('shipmentTrackAllWbns', e.target.checked)
                          }
                        />
                      </Flex>

                      <Button
                        variant="outline"
                        onClick={() => handleShipmentTrack(account)}
                        isLoading={b2bShipmentTrackMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.shipmentTrackLrn || '').trim()
                        }
                      >
                        Track Shipment
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Appointment LRN</FormLabel>
                          <Input
                            value={b2bTestInputs.appointmentLrn}
                            onChange={(e) => updateB2BTestInput('appointmentLrn', e.target.value)}
                            placeholder="LRN for last-mile appointment"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Appointment Date</FormLabel>
                          <Input
                            value={b2bTestInputs.appointmentDate}
                            onChange={(e) => updateB2BTestInput('appointmentDate', e.target.value)}
                            placeholder="DD/MM/YYYY"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Appointment Slot</FormLabel>
                          <Input
                            value={b2bTestInputs.appointmentSlot}
                            onChange={(e) => updateB2BTestInput('appointmentSlot', e.target.value)}
                            placeholder="12:00 PM-03:00 PM"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>PO Expiry Date</FormLabel>
                          <Input
                            value={b2bTestInputs.appointmentPoExpiryDate}
                            onChange={(e) =>
                              updateB2BTestInput('appointmentPoExpiryDate', e.target.value)
                            }
                            placeholder="DD/MM/YYYY"
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>PO Numbers</FormLabel>
                          <Input
                            value={b2bTestInputs.appointmentPoNumbers}
                            onChange={(e) =>
                              updateB2BTestInput('appointmentPoNumbers', e.target.value)
                            }
                            placeholder="Comma separated PO numbers, or NotApplicable"
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>Appointment ID</FormLabel>
                          <Input
                            value={b2bTestInputs.appointmentId}
                            onChange={(e) => updateB2BTestInput('appointmentId', e.target.value)}
                            placeholder="Optional appointment ID"
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() => handleAppointmentBooking(account)}
                        isLoading={b2bAppointmentBookMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.appointmentLrn || '').trim() ||
                          !String(b2bTestInputs.appointmentDate || '').trim() ||
                          !String(b2bTestInputs.appointmentSlot || '').trim() ||
                          !String(b2bTestInputs.appointmentPoExpiryDate || '').trim()
                        }
                      >
                        Book Last-Mile Appointment
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Pickup Warehouse</FormLabel>
                          <Input
                            value={b2bTestInputs.pickupRequestWarehouse}
                            onChange={(e) =>
                              updateB2BTestInput('pickupRequestWarehouse', e.target.value)
                            }
                            placeholder="Registered client warehouse name"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Pickup Date</FormLabel>
                          <Input
                            value={b2bTestInputs.pickupRequestDate}
                            onChange={(e) =>
                              updateB2BTestInput('pickupRequestDate', e.target.value)
                            }
                            placeholder="YYYY-MM-DD"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Start Time</FormLabel>
                          <Input
                            value={b2bTestInputs.pickupRequestStartTime}
                            onChange={(e) =>
                              updateB2BTestInput('pickupRequestStartTime', e.target.value)
                            }
                            placeholder="HH:MM:SS"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Expected Package Count</FormLabel>
                          <Input
                            value={b2bTestInputs.pickupRequestExpectedPackageCount}
                            onChange={(e) =>
                              updateB2BTestInput(
                                'pickupRequestExpectedPackageCount',
                                e.target.value,
                              )
                            }
                            placeholder="1"
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>X-Request-Id</FormLabel>
                          <Input
                            value={b2bTestInputs.pickupRequestId}
                            onChange={(e) => updateB2BTestInput('pickupRequestId', e.target.value)}
                            placeholder="Optional unique request id"
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() => handlePickupRequestCreate(account)}
                        isLoading={b2bPickupRequestCreateMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.pickupRequestWarehouse || '').trim() ||
                          !String(b2bTestInputs.pickupRequestDate || '').trim() ||
                          !String(b2bTestInputs.pickupRequestStartTime || '').trim() ||
                          !String(b2bTestInputs.pickupRequestExpectedPackageCount || '').trim()
                        }
                      >
                        Create Pickup Request
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Pickup Cancel ID</FormLabel>
                          <Input
                            value={b2bTestInputs.pickupCancelId}
                            onChange={(e) => updateB2BTestInput('pickupCancelId', e.target.value)}
                            placeholder="Pickup id to cancel"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Cancel X-Request-Id</FormLabel>
                          <Input
                            value={b2bTestInputs.pickupCancelRequestId}
                            onChange={(e) =>
                              updateB2BTestInput('pickupCancelRequestId', e.target.value)
                            }
                            placeholder="Optional unique request id"
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() => handlePickupRequestCancel(account)}
                        isLoading={b2bPickupRequestCancelMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.pickupCancelId || '').trim()
                        }
                      >
                        Cancel Pickup Request
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Label Size</FormLabel>
                          <Input
                            value={b2bTestInputs.labelSize}
                            onChange={(e) => updateB2BTestInput('labelSize', e.target.value)}
                            placeholder="sm | md | a4 | std"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Label LRN</FormLabel>
                          <Input
                            value={b2bTestInputs.labelLrn}
                            onChange={(e) => updateB2BTestInput('labelLrn', e.target.value)}
                            placeholder="LRN for label URLs"
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() => handleLabelUrls(account)}
                        isLoading={b2bLabelUrlsMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.labelSize || '').trim() ||
                          !String(b2bTestInputs.labelLrn || '').trim()
                        }
                      >
                        Generate Shipping Label URLs
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>LR Copy LRN</FormLabel>
                          <Input
                            value={b2bTestInputs.lrCopyLrn}
                            onChange={(e) => updateB2BTestInput('lrCopyLrn', e.target.value)}
                            placeholder="LRN for LR copy PDF"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>LR Copy Type</FormLabel>
                          <Input
                            value={b2bTestInputs.lrCopyType}
                            onChange={(e) => updateB2BTestInput('lrCopyType', e.target.value)}
                            placeholder="Comma separated copy types, or blank for all"
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>LR Copy X-Request-Id</FormLabel>
                          <Input
                            value={b2bTestInputs.lrCopyRequestId}
                            onChange={(e) => updateB2BTestInput('lrCopyRequestId', e.target.value)}
                            placeholder="Optional unique request id"
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() => handleLrCopy(account)}
                        isLoading={b2bLrCopyMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.lrCopyLrn || '').trim()
                        }
                      >
                        Fetch LR Copy PDF
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Document Type</FormLabel>
                          <Input
                            value={b2bTestInputs.documentDocType}
                            onChange={(e) =>
                              updateB2BTestInput('documentDocType', e.target.value)
                            }
                            placeholder="shipping_label or lr_copy"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Document Size</FormLabel>
                          <Input
                            value={b2bTestInputs.documentSize}
                            onChange={(e) => updateB2BTestInput('documentSize', e.target.value)}
                            placeholder="sm | md | a4 | std"
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>Document LRNs</FormLabel>
                          <Textarea
                            rows={3}
                            value={b2bTestInputs.documentLrns}
                            onChange={(e) => updateB2BTestInput('documentLrns', e.target.value)}
                            placeholder="Comma separated LRNs, max 25"
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>LR Copy Types</FormLabel>
                          <Input
                            value={b2bTestInputs.documentLrCopyTypes}
                            onChange={(e) =>
                              updateB2BTestInput('documentLrCopyTypes', e.target.value)
                            }
                            placeholder="Comma separated copy types for lr_copy, or blank for all"
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>Callback URI</FormLabel>
                          <Input
                            value={b2bTestInputs.documentCallbackUri}
                            onChange={(e) =>
                              updateB2BTestInput('documentCallbackUri', e.target.value)
                            }
                            placeholder="https://example.com/callback"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Callback Method</FormLabel>
                          <Input
                            value={b2bTestInputs.documentCallbackMethod}
                            onChange={(e) =>
                              updateB2BTestInput('documentCallbackMethod', e.target.value)
                            }
                            placeholder="POST"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Callback Authorization</FormLabel>
                          <Input
                            value={b2bTestInputs.documentCallbackAuthorization}
                            onChange={(e) =>
                              updateB2BTestInput('documentCallbackAuthorization', e.target.value)
                            }
                            placeholder="Bearer Token"
                          />
                        </FormControl>
                        <FormControl gridColumn={{ base: 'auto', md: '1 / -1' }}>
                          <FormLabel>Document X-Request-Id</FormLabel>
                          <Input
                            value={b2bTestInputs.documentRequestId}
                            onChange={(e) =>
                              updateB2BTestInput('documentRequestId', e.target.value)
                            }
                            placeholder="Optional unique request id"
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() => handleDocumentGenerate(account)}
                        isLoading={b2bDocumentGenerateMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.documentDocType || '').trim() ||
                          !String(b2bTestInputs.documentLrns || '').trim() ||
                          !String(b2bTestInputs.documentCallbackUri || '').trim() ||
                          !String(b2bTestInputs.documentCallbackMethod || '').trim()
                        }
                      >
                        Generate Document
                      </Button>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <FormControl>
                          <FormLabel>Document Job ID</FormLabel>
                          <Input
                            value={b2bTestInputs.documentJobId}
                            onChange={(e) => updateB2BTestInput('documentJobId', e.target.value)}
                            placeholder="job_id returned from document generation"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Status X-Request-Id</FormLabel>
                          <Input
                            value={b2bTestInputs.documentStatusRequestId}
                            onChange={(e) =>
                              updateB2BTestInput('documentStatusRequestId', e.target.value)
                            }
                            placeholder="Optional unique request id"
                          />
                        </FormControl>
                      </Grid>

                      <Button
                        variant="outline"
                        onClick={() => handleDocumentStatus(account)}
                        isLoading={b2bDocumentStatusMutation.isPending}
                        isDisabled={
                          !account.hasB2BAuthToken ||
                          !String(b2bTestInputs.documentDocType || '').trim() ||
                          !String(b2bTestInputs.documentJobId || '').trim()
                        }
                      >
                        Check Document Status
                      </Button>
                    </Stack>
                  </>
                )}

                <FormControl>
                  <FormLabel>Pickup Location IDs</FormLabel>
                  <Textarea
                    rows={3}
                    value={(account.pickupLocationIds || []).join('\n')}
                    onChange={(e) =>
                      updateAccount(index, {
                        pickupLocationIds: normalizeArrayInput(e.target.value),
                      })
                    }
                    placeholder="One pickup location ID per line"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Pickup Warehouse Names</FormLabel>
                  <Textarea
                    rows={3}
                    value={(account.pickupLocationNames || []).join('\n')}
                    onChange={(e) =>
                      updateAccount(index, {
                        pickupLocationNames: normalizeArrayInput(e.target.value),
                      })
                    }
                    placeholder="One warehouse name per line"
                  />
                </FormControl>

                <Stack spacing={3} pt={1}>
                  <Flex align="center" justify="space-between">
                    <Text fontSize="sm">Active for booking</Text>
                    <Switch
                      isChecked={account.isActive}
                      onChange={(e) => updateAccount(index, { isActive: e.target.checked })}
                    />
                  </Flex>

                  <Flex align="center" justify="space-between">
                    <Text fontSize="sm">Default fallback account</Text>
                    <Switch
                      isChecked={account.isDefault}
                      onChange={() => handleToggleDefault(index)}
                    />
                  </Flex>
                </Stack>
              </VStack>
            </Box>
          </GridItem>
        ))}
      </Grid>

      <Flex justify="flex-end">
        <Button
          colorScheme="blue"
          onClick={handleSave}
          isLoading={updateDelhivery.isPending}
        >
          Save Delhivery Accounts
        </Button>
      </Flex>
    </Flex>
  )
}

export default CourierCredentials
