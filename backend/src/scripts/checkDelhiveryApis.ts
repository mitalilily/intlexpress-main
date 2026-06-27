import axios, { type AxiosRequestConfig } from 'axios'

type StepResult = {
  name: string
  status: number
  ok: boolean
  summary: string
}

const token = process.env.DELHIVERY_API_TOKEN || process.argv[2] || ''
const baseUrl = (process.env.DELHIVERY_API_BASE || 'https://track.delhivery.com').replace(/\/+$/, '')

if (!token) {
  console.error('Missing Delhivery token. Set DELHIVERY_API_TOKEN or pass it as the first argument.')
  process.exit(1)
}

const headersJson = {
  Authorization: `Token ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const headersForm = {
  Authorization: `Token ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded',
}

const summarize = (value: unknown): string => {
  if (Buffer.isBuffer(value)) return `buffer:${value.byteLength}`
  if (typeof value === 'string') return value.length > 180 ? `${value.slice(0, 177)}...` : value
  try {
    const text = JSON.stringify(value)
    return text.length > 180 ? `${text.slice(0, 177)}...` : text
  } catch {
    return String(value)
  }
}

const logStep = (result: StepResult) => {
  const marker = result.ok ? 'PASS' : 'FAIL'
  console.log(`${marker} ${result.name} [${result.status}] ${result.summary}`)
}

const record = (results: StepResult[], name: string, status: number, summary: string) => {
  const result = { name, status, ok: status >= 200 && status < 300, summary }
  results.push(result)
  logStep(result)
  return result
}

const postManifest = async (payload: Record<string, any>) => {
  const form = new URLSearchParams({
    format: 'json',
    data: JSON.stringify(payload),
  })

  return axios.post(`${baseUrl}/api/cmu/create.json`, form.toString(), {
    headers: headersForm,
    timeout: 70000,
    validateStatus: () => true,
  })
}

const request = async (
  config: AxiosRequestConfig,
  responseType: 'json' | 'arraybuffer' = 'json',
) =>
  axios({
    timeout: 30000,
    validateStatus: () => true,
    responseType,
    ...config,
  })

const main = async () => {
  const results: StepResult[] = []
  const suffix = Date.now()
  const warehouseName = `IntleExpress API Test ${suffix}`

  let clientName = 'INTLEXPRESS JAIPUR C2C'
  let ndrRequestId = ''
  let rvpWaybill = ''

  const shippingCost = await request({
    method: 'get',
    url: `${baseUrl}/api/kinko/v1/invoice/charges/.json`,
    params: {
      md: 'E',
      ss: 'Delivered',
      d_pin: '110053',
      o_pin: '110042',
      cgm: 10,
      pt: 'Pre-paid',
    },
    headers: headersJson,
    timeout: 70000,
  })
  record(results, 'shipping_cost', shippingCost.status, summarize(shippingCost.data))

  const trackFake = await request({
    method: 'get',
    url: `${baseUrl}/api/v1/packages/json/`,
    params: { waybill: '1122345678722', ref_ids: '' },
    headers: headersJson,
  })
  record(results, 'tracking_fake', trackFake.status, summarize(trackFake.data))

  const labelFake = await request({
    method: 'get',
    url: `${baseUrl}/api/p/packing_slip`,
    params: { wbns: '703500000000000', pdf: false },
    headers: headersJson,
  })
  record(results, 'label_fake', labelFake.status, summarize(labelFake.data))

  const cancelFake = await request({
    method: 'post',
    url: `${baseUrl}/api/p/edit`,
    data: { waybill: '694500000000', cancellation: 'true' },
    headers: headersJson,
  })
  record(results, 'cancel_fake', cancelFake.status, summarize(cancelFake.data))

  const updateFake = await request({
    method: 'post',
    url: `${baseUrl}/api/p/edit`,
    data: { waybill: '843000000000', pt: 'Pre-paid', shipment_height: 40.2, gm: 100.2 },
    headers: headersJson,
  })
  record(results, 'update_fake', updateFake.status, summarize(updateFake.data))

  const ewaybillFake = await request({
    method: 'put',
    url: `${baseUrl}/api/rest/ewaybill/843000000000/`,
    data: { data: [{ dcn: `INV-${suffix}`, ewbn: 'EWBTEST12345' }] },
    headers: headersJson,
  })
  record(results, 'ewaybill_fake', ewaybillFake.status, summarize(ewaybillFake.data))

  const ndrAction = await request({
    method: 'post',
    url: `${baseUrl}/api/p/update`,
    data: { data: [{ waybill: '13163116000000', act: 'RE-ATTEMPT' }] },
    headers: headersJson,
  })
  ndrRequestId = String(ndrAction.data?.request_id || '')
  record(results, 'ndr_action', ndrAction.status, summarize(ndrAction.data))

  if (ndrRequestId) {
    const ndrStatus = await request({
      method: 'get',
      url: `${baseUrl}/api/cmu/get_bulk_upl/${encodeURIComponent(ndrRequestId)}`,
      params: { verbose: true },
      headers: headersJson,
      timeout: 70000,
    })
    record(results, 'ndr_status', ndrStatus.status, summarize(ndrStatus.data))
  }

  const warehouseCreate = await request({
    method: 'post',
    url: `${baseUrl}/api/backend/clientwarehouse/create/`,
    data: {
      phone: '9999999999',
      city: 'Delhi',
      name: warehouseName,
      pin: '110042',
      address: 'API test warehouse address',
      country: 'India',
      email: 'ops@intlexpress.test',
      registered_name: 'IntleExpress',
      return_address: 'API test return address',
      return_pin: '110042',
      return_city: 'Delhi',
      return_state: 'Delhi',
      return_country: 'India',
    },
    headers: headersJson,
  })
  clientName = String(warehouseCreate.data?.data?.client || clientName)
  record(results, 'warehouse_create', warehouseCreate.status, summarize(warehouseCreate.data))

  const warehouseUpdate = await request({
    method: 'post',
    url: `${baseUrl}/api/backend/clientwarehouse/edit/`,
    data: {
      name: warehouseName,
      phone: '9999999998',
      address: 'API test warehouse address updated',
      pin: '110042',
    },
    headers: headersJson,
  })
  record(results, 'warehouse_update', warehouseUpdate.status, summarize(warehouseUpdate.data))

  const waybillsResponse = await request({
    method: 'get',
    url: `${baseUrl}/waybill/api/bulk/json/`,
    params: { cl: clientName, token, count: 2 },
    headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
  })
  record(results, 'fetch_waybills', waybillsResponse.status, summarize(waybillsResponse.data))
  const waybills = String(waybillsResponse.data || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const [masterWaybill, childWaybill] = waybills

  if (masterWaybill && childWaybill) {
    const mpsManifest = await postManifest({
      pickup_location: { name: warehouseName },
      shipments: [
        {
          order: `MPS-${suffix}`,
          order_date: '2026-06-27',
          name: 'Test Customer',
          phone: '9999888800',
          add: 'Test Address Line 1',
          city: 'CHENNAI',
          state: 'TAMIL NADU',
          pin: '600063',
          country: 'India',
          payment_mode: 'Prepaid',
          cod_amount: 0,
          total_amount: 4250,
          products_desc: 'Toys, ToyCar',
          weight: 100,
          shipment_length: 10,
          shipment_width: 10,
          shipment_height: 10,
          seller_name: 'IntleExpress',
          seller_add: 'API test warehouse address',
          seller_city: 'Delhi',
          seller_state: 'Delhi',
          seller_pin: '110042',
          seller_phone: '9999999999',
          seller_inv: `INV-${suffix}`,
          invoice_reference: `INV-${suffix}`,
          invoice_date: '2026-06-27',
          pickup_location: warehouseName,
          pickup_address: 'API test warehouse address',
          pickup_city: 'Delhi',
          pickup_state: 'Delhi',
          pickup_pin: '110042',
          pickup_phone: '9999999999',
          pickup_country: 'India',
          shipment_type: 'MPS',
          master_id: masterWaybill,
          mps_children: 2,
          mps_amount: 0,
          waybill: masterWaybill,
          client: clientName,
          client_name: clientName,
        },
        {
          order: `MPS-${suffix}`,
          order_date: '2026-06-27',
          name: 'Test Customer',
          phone: '9999888800',
          add: 'Test Address Line 1',
          city: 'CHENNAI',
          state: 'TAMIL NADU',
          pin: '600063',
          country: 'India',
          payment_mode: 'Prepaid',
          cod_amount: 0,
          total_amount: 4250,
          products_desc: 'Toys, ToyCar',
          weight: 100,
          shipment_length: 10,
          shipment_width: 10,
          shipment_height: 10,
          seller_name: 'IntleExpress',
          seller_add: 'API test warehouse address',
          seller_city: 'Delhi',
          seller_state: 'Delhi',
          seller_pin: '110042',
          seller_phone: '9999999999',
          seller_inv: `INV-${suffix}`,
          invoice_reference: `INV-${suffix}`,
          invoice_date: '2026-06-27',
          pickup_location: warehouseName,
          pickup_address: 'API test warehouse address',
          pickup_city: 'Delhi',
          pickup_state: 'Delhi',
          pickup_pin: '110042',
          pickup_phone: '9999999999',
          pickup_country: 'India',
          shipment_type: 'MPS',
          master_id: masterWaybill,
          mps_children: 2,
          mps_amount: 0,
          waybill: childWaybill,
          client: clientName,
          client_name: clientName,
        },
      ],
    })
    record(results, 'mps_manifest', mpsManifest.status, summarize(mpsManifest.data))
  }

  const rvpQc = await postManifest({
    pickup_location: { name: warehouseName },
    shipments: [
      {
        order: `RVP-${suffix}`,
        order_date: '2026-06-27',
        name: 'Reverse Customer',
        phone: '9999888800',
        add: 'Reverse pickup customer address',
        city: 'Delhi',
        state: 'Delhi',
        pin: '110001',
        country: 'India',
        payment_mode: 'Pickup',
        package_type: 'Pickup',
        total_amount: 1000,
        cod_amount: 0,
        products_desc: 'Returned Shoes',
        weight: 500,
        shipment_length: 10,
        shipment_width: 10,
        shipment_height: 10,
        seller_name: 'IntleExpress',
        seller_add: 'API test warehouse address',
        seller_city: 'Delhi',
        seller_state: 'Delhi',
        seller_pin: '110042',
        seller_phone: '9999999999',
        seller_inv: `RVPINV-${suffix}`,
        invoice_reference: `RVPINV-${suffix}`,
        invoice_date: '2026-06-27',
        pickup_location: warehouseName,
        pickup_address: 'API test warehouse address',
        pickup_city: 'Delhi',
        pickup_state: 'Delhi',
        pickup_pin: '110042',
        pickup_phone: '9999999999',
        pickup_country: 'India',
        return_name: 'Return Hub',
        return_add: 'Return Address',
        return_address: 'Return Address',
        return_city: 'Delhi',
        return_state: 'Delhi',
        return_pin: '110042',
        return_phone: '9999999999',
        return_country: 'India',
        qc_type: 'param',
        custom_qc: [
          {
            item: 'Returned Shoes',
            description: 'Check pair condition',
            images: ['https://example.com/item-front.jpg'],
            quantity: 1,
            questions: [
              {
                questions_id: 'client-q-1',
                type: 'multi',
                required: true,
                options: [{ value: ['Yes'] }, { value: ['No'] }],
              },
            ],
          },
        ],
      },
    ],
  })
  record(results, 'rvp_qc_manifest', rvpQc.status, summarize(rvpQc.data))
  rvpWaybill = String(rvpQc.data?.packages?.[0]?.waybill || '')

  if (rvpWaybill) {
    const trackReal = await request({
      method: 'get',
      url: `${baseUrl}/api/v1/packages/json/`,
      params: { waybill: rvpWaybill, ref_ids: '' },
      headers: headersJson,
      timeout: 70000,
    })
    record(results, 'tracking_real_rvp', trackReal.status, summarize(trackReal.data))

    const labelJson = await request({
      method: 'get',
      url: `${baseUrl}/api/p/packing_slip`,
      params: { wbns: rvpWaybill, pdf: false },
      headers: headersJson,
      timeout: 70000,
    })
    record(results, 'label_json_real_rvp', labelJson.status, summarize(labelJson.data))

    const labelPdf = await request(
      {
        method: 'get',
        url: `${baseUrl}/api/p/packing_slip`,
        params: { wbns: rvpWaybill, pdf: true, pdf_size: '4R' },
        headers: headersJson,
        timeout: 70000,
      },
      'arraybuffer',
    )
    record(results, 'label_pdf_real_rvp', labelPdf.status, summarize(labelPdf.data))

    const updateReal = await request({
      method: 'post',
      url: `${baseUrl}/api/p/edit`,
      data: {
        waybill: rvpWaybill,
        name: 'Reverse Customer Updated',
        gm: 550.5,
        shipment_height: 12.5,
        shipment_width: 10.5,
        shipment_length: 10.5,
      },
      headers: headersJson,
    })
    record(results, 'update_real_rvp', updateReal.status, summarize(updateReal.data))

    const ewaybillReal = await request({
      method: 'put',
      url: `${baseUrl}/api/rest/ewaybill/${encodeURIComponent(rvpWaybill)}/`,
      data: { data: [{ dcn: `RVPINV-${suffix}`, ewbn: 'EWB123456789012' }] },
      headers: headersJson,
    })
    record(results, 'ewaybill_real_rvp', ewaybillReal.status, summarize(ewaybillReal.data))

    const cancelReal = await request({
      method: 'post',
      url: `${baseUrl}/api/p/edit`,
      data: { waybill: rvpWaybill, cancellation: 'true' },
      headers: headersJson,
    })
    record(results, 'cancel_real_rvp', cancelReal.status, summarize(cancelReal.data))
  }

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const pickupRequest = await request({
    method: 'post',
    url: `${baseUrl}/fm/request/new/`,
    data: {
      pickup_time: '11:00:00',
      pickup_date: tomorrow,
      pickup_location: warehouseName,
      expected_package_count: 1,
    },
    headers: headersJson,
  })
  const pickupStep = record(
    results,
    'pickup_request',
    pickupRequest.status,
    summarize(pickupRequest.data),
  )

  console.log('\nSummary:')
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Warehouse: ${warehouseName}`)
  console.log(`Client: ${clientName}`)
  console.log(`NDR request id: ${ndrRequestId || 'n/a'}`)
  console.log(`RVP waybill: ${rvpWaybill || 'n/a'}`)

  const hardFailures = results.filter(
    (result) => !result.ok && result.name !== pickupStep.name,
  )
  if (hardFailures.length > 0) {
    console.error('\nNon-2xx responses:')
    for (const failure of hardFailures) {
      console.error(`- ${failure.name}: ${failure.status} ${failure.summary}`)
    }
    process.exit(1)
  }

  if (!pickupStep.ok) {
    console.warn('\nPickup request is not treated as a hard failure because this account may be blocked by wallet balance or provider-side pickup eligibility.')
  }
}

main().catch((error: any) => {
  console.error('checkDelhiveryApis failed:', error?.message || error)
  process.exit(1)
})
