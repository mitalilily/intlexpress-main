import { Response } from 'express'
import { eq } from 'drizzle-orm'
import {
  addManualNdrToOrderServiceAdmin,
  getAllOrdersServiceAdmin,
  regenerateOrderDocumentsServiceAdmin,
  updateOrderStatusServiceAdmin,
} from '../../models/services/adminOrders.service'
import { db } from '../../models/client'
import { DelhiveryService } from '../../models/services/couriers/delhivery.service'
import { ShadowfaxService } from '../../models/services/couriers/shadowfax.service'
import {
  appendReversePickupTags,
  assertReversePickupAllowed,
  getOriginalOrderForReversePickup,
  quoteReverseForOrder,
} from '../../models/services/reverse.service'
import { createB2CShipmentService } from '../../models/services/shiprocket.service'
import { b2c_orders } from '../../schema/schema'
import { buildCsv } from '../../utils/csv'
import {
  buildDelhiveryEwaybillUpdateProviderMeta,
  isDelhiveryEwaybillUpdateAccepted,
  isDelhiveryEwaybillUpdateRequest,
  validateAndNormalizeDelhiveryEwaybillUpdate,
} from '../../utils/delhiveryEwaybillUpdate'
import {
  buildDelhiveryShipmentUpdateProviderMeta,
  isDelhiveryShipmentUpdateAccepted,
  validateAndNormalizeDelhiveryShipmentUpdate,
} from '../../utils/delhiveryShipmentUpdate'
import {
  ADMIN_ORDER_EXPORT_HEADERS,
  toAdminOrderExportRow,
} from '../../utils/adminOrderExportCsv'

export const getAllOrdersControllerAdmin = async (req: any, res: Response) => {
  try {
    // Pagination params
    const page = parseInt(req.query.page as string, 10) || 1
    const limit = parseInt(req.query.limit as string, 10) || 10

    // Filters from query
    const filters = {
      status: req.query.status as string | undefined,
      orderType: (req.query.orderType || req.query.type) as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      search: req.query.search as string | undefined,
      userId: req.query.userId as string | undefined,
      pickupAlert: req.query.pickupAlert as string | undefined,
      sortBy: (req.query.sortBy as 'created_at' | undefined) || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined) || 'desc',
    }

    const { orders, totalCount, totalPages } = await getAllOrdersServiceAdmin({
      page,
      limit,
      filters,
    })

    res.status(200).json({ success: true, orders, totalCount, totalPages })
  } catch (error: any) {
    console.error('Error fetching all orders:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const exportOrdersControllerAdmin = async (req: any, res: Response) => {
  try {
    // Filters from query
    const filters = {
      status: req.query.status as string | undefined,
      orderType: (req.query.orderType || req.query.type) as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      search: req.query.search as string | undefined,
      userId: req.query.userId as string | undefined,
      pickupAlert: req.query.pickupAlert as string | undefined,
      sortBy: (req.query.sortBy as 'created_at' | undefined) || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined) || 'desc',
    }

    // Fetch all orders without pagination for export
    const { orders } = await getAllOrdersServiceAdmin({
      page: 1,
      limit: 100000, // Large limit to get all orders
      filters,
      sanitizeDocuments: false,
    })

    const csv = buildCsv(ADMIN_ORDER_EXPORT_HEADERS, orders.map(toAdminOrderExportRow))

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=orders_export_${new Date().toISOString().split('T')[0]}.csv`)
    res.status(200).send(csv)
  } catch (error: any) {
    console.error('Error exporting orders:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const regenerateOrderDocumentsControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const regenerateLabel =
      typeof req.body?.regenerateLabel === 'boolean' ? req.body.regenerateLabel : true
    const regenerateInvoice =
      typeof req.body?.regenerateInvoice === 'boolean' ? req.body.regenerateInvoice : true

    const result = await regenerateOrderDocumentsServiceAdmin({
      orderId,
      regenerateLabel,
      regenerateInvoice,
    })

    return res.status(200).json({
      success: true,
      message: 'Order documents regenerated successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('Error regenerating order documents:', error?.message || error)
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to regenerate order documents',
    })
  }
}

export const addManualNdrToOrderControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const result = await addManualNdrToOrderServiceAdmin({
      orderId,
      adminUserId: req.user?.sub,
      status: req.body?.status,
      reason: req.body?.reason,
      remarks: req.body?.remarks,
      attemptNo: req.body?.attemptNo,
    })

    return res.status(200).json({
      success: true,
      message: 'NDR added successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('Error adding manual NDR to order:', error?.message || error)
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to add NDR to order',
    })
  }
}

export const updateOrderStatusControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const result = await updateOrderStatusServiceAdmin({
      orderId,
      adminUserId: req.user?.sub,
      status: req.body?.status,
      reason: req.body?.reason,
      remarks: req.body?.remarks,
      attemptNo: req.body?.attemptNo,
    })

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('Error updating order status:', error?.message || error)
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to update order status',
    })
  }
}

const getAdminB2COrderById = async (orderId: string) => {
  const [order] = await db.select().from(b2c_orders).where(eq(b2c_orders.id, orderId)).limit(1)
  return order || null
}

export const getProviderPodControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
    const order = await getAdminB2COrderById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (String(order.integration_type || '').toLowerCase() !== 'shadowfax') {
      return res.status(400).json({ success: false, message: 'Only Shadowfax POD is supported here.' })
    }

    const shadowfax = new ShadowfaxService()
    const reference = String(
      order.provider_request_id || order.provider_reference || order.awb_number || '',
    ).trim()
    const reverse =
      String(order.order_type || '').toLowerCase() === 'reverse' ||
      reference.toUpperCase().startsWith('R')
    const data = await shadowfax.getPodDetails([reference], reverse)
    return res.status(200).json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching provider POD:', error)
    return res.status(500).json({ success: false, message: error?.message || 'Failed to fetch provider POD' })
  }
}

export const escalateProviderOrderControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
    const order = await getAdminB2COrderById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (String(order.integration_type || '').toLowerCase() !== 'shadowfax') {
      return res.status(400).json({ success: false, message: 'Only Shadowfax escalation is supported here.' })
    }

    const issueCategory = Number(req.body?.issue_category)
    if (!Number.isFinite(issueCategory) || issueCategory <= 0) {
      return res.status(400).json({ success: false, message: 'issue_category must be a positive number' })
    }

    const shadowfax = new ShadowfaxService()
    const data = await shadowfax.createEscalation({
      awb_number: String(order.awb_number || order.provider_request_id || ''),
      issue_category: issueCategory,
    })
    return res.status(200).json({ success: true, data })
  } catch (error: any) {
    console.error('Error escalating provider order:', error)
    return res.status(500).json({ success: false, message: error?.message || 'Failed to escalate provider order' })
  }
}

export const generateProviderQrControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
    const order = await getAdminB2COrderById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (String(order.integration_type || '').toLowerCase() !== 'shadowfax') {
      return res.status(400).json({ success: false, message: 'Only Shadowfax QR generation is supported here.' })
    }

    const shadowfax = new ShadowfaxService()
    const data = await shadowfax.generateQrCode({
      awb_number: order.awb_number,
      client_request_id: order.provider_request_id || undefined,
      ...req.body,
    })
    return res.status(200).json({ success: true, data })
  } catch (error: any) {
    console.error('Error generating provider QR:', error)
    return res.status(500).json({ success: false, message: error?.message || 'Failed to generate provider QR' })
  }
}

export const updateProviderOrderControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
    const order = await getAdminB2COrderById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    const provider = String(order.integration_type || '').toLowerCase()
    if (provider === 'delhivery') {
      const delhivery = new DelhiveryService({ order })
      if (isDelhiveryEwaybillUpdateRequest(req.body || {})) {
        const { awb, providerPayload, localOrderPatch } =
          validateAndNormalizeDelhiveryEwaybillUpdate({
            order,
            payload: req.body || {},
          })
        const data = await delhivery.updateEwaybill(awb, providerPayload)

        if (!isDelhiveryEwaybillUpdateAccepted(data)) {
          return res.status(502).json({
            success: false,
            message:
              data?.message ||
              data?.error ||
              'Delhivery did not accept the E-waybill update request.',
            data: {
              provider: 'delhivery',
              awb_number: awb,
              provider_response: data,
            },
          })
        }

        await db
          .update(b2c_orders)
          .set({
            ...localOrderPatch,
            provider_meta: buildDelhiveryEwaybillUpdateProviderMeta({
              existingMeta: order.provider_meta,
              requestPayload: providerPayload,
              response: data,
            }) as any,
            updated_at: new Date(),
          } as any)
          .where(eq(b2c_orders.id, order.id))

        return res.status(200).json({ success: true, data })
      }

      const { awb, providerPayload, localOrderPatch } = validateAndNormalizeDelhiveryShipmentUpdate({
        order,
        payload: req.body || {},
      })
      const data = await delhivery.updateShipment(awb, providerPayload)

      if (!isDelhiveryShipmentUpdateAccepted(data)) {
        return res.status(502).json({
          success: false,
          message:
            data?.message ||
            data?.error ||
            'Delhivery did not accept the shipment update request.',
          data: {
            provider: 'delhivery',
            awb_number: awb,
            provider_response: data,
          },
        })
      }

      await db
        .update(b2c_orders)
        .set({
          ...localOrderPatch,
          provider_meta: buildDelhiveryShipmentUpdateProviderMeta({
            existingMeta: order.provider_meta,
            requestPayload: providerPayload,
            response: data,
          }) as any,
          updated_at: new Date(),
        } as any)
        .where(eq(b2c_orders.id, order.id))

      return res.status(200).json({ success: true, data })
    }

    if (provider !== 'shadowfax') {
      return res
        .status(400)
        .json({ success: false, message: 'Only Delhivery and Shadowfax provider updates are supported here.' })
    }

    const shadowfax = new ShadowfaxService()
    const reference = String(
      order.provider_request_id || order.provider_reference || order.awb_number || '',
    ).trim()
    const reverse =
      String(order.order_type || '').toLowerCase() === 'reverse' ||
      reference.toUpperCase().startsWith('R')
    const payload = {
      awb_number: order.awb_number || undefined,
      request_id: reverse ? reference : undefined,
      client_request_id: reverse ? reference : undefined,
      client_order_id: order.order_number,
      ...req.body,
    }
    const data =
      reverse && Object.prototype.hasOwnProperty.call(req.body || {}, 'qc_flag')
        ? await shadowfax.updateReverseQcFlag({
            awb_number: reference,
            qc_flag: Boolean((req.body || {}).qc_flag),
            ...(req.body?.sku_id ? { sku_id: String(req.body.sku_id) } : {}),
          })
        : reverse
        ? await shadowfax.updateReverseOrder(payload)
        : await shadowfax.updateForwardOrder(payload)
    return res.status(200).json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating provider order:', error)
    const statusCode =
      typeof error?.statusCode === 'number'
        ? error.statusCode
        : typeof error?.response?.status === 'number'
          ? error.response.status
          : 500
    return res.status(statusCode).json({ success: false, message: error?.message || 'Failed to update provider order' })
  }
}

const getOriginalOrderIdFromBody = (body: Record<string, any>) =>
  String(body?.original_order_id || body?.order_id || body?.orderId || '').trim()

export const quoteReverseOrderControllerAdmin = async (req: any, res: Response) => {
  try {
    const body = req.body || {}
    const originalOrderId = getOriginalOrderIdFromBody(body)
    if (!originalOrderId) {
      return res.status(400).json({ success: false, message: 'Original order ID is required' })
    }

    const originalOrder = await getOriginalOrderForReversePickup(originalOrderId)
    if (!originalOrder?.user_id) {
      return res.status(404).json({ success: false, message: 'Original order not found' })
    }

    await assertReversePickupAllowed(originalOrderId, originalOrder.user_id)
    const quote = await quoteReverseForOrder(
      originalOrderId,
      body?.weightGrams ? Number(body.weightGrams) : undefined,
      originalOrder.user_id,
    )

    return res.status(200).json({
      success: true,
      quote,
      order: {
        id: originalOrder.id,
        user_id: originalOrder.user_id,
        order_number: originalOrder.order_number,
        integration_type: originalOrder.integration_type,
      },
    })
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 400
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to quote reverse order',
    })
  }
}

export const createReverseOrderControllerAdmin = async (req: any, res: Response) => {
  try {
    const body = req.body || {}
    const originalOrderId = getOriginalOrderIdFromBody(body)
    if (!originalOrderId) {
      return res.status(400).json({ success: false, message: 'Original order ID is required' })
    }

    const originalOrder = await getOriginalOrderForReversePickup(originalOrderId)
    if (!originalOrder?.user_id) {
      return res.status(404).json({ success: false, message: 'Original order not found' })
    }

    await assertReversePickupAllowed(originalOrderId, originalOrder.user_id)
    const quote = await quoteReverseForOrder(
      originalOrderId,
      body?.weightGrams ? Number(body.weightGrams) : undefined,
      originalOrder.user_id,
    )
    const reverseCharge = Number(quote.rate || 0)
    if (!Number.isFinite(reverseCharge) || reverseCharge <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No reverse pickup rate available for this order',
      })
    }

    const payload = {
      ...body,
      original_order_id: originalOrderId,
      payment_type: 'reverse',
      package_weight: Number(quote.weightGrams || 0) / 1000,
      shipping_charges: reverseCharge,
      freight_charges: reverseCharge,
      selected_max_slab_weight: quote.max_slab_weight ?? undefined,
      courier_id: body.courier_id ?? quote.courierId,
      tags: appendReversePickupTags(body.tags, originalOrderId),
    }

    const shipment = await createB2CShipmentService(payload, originalOrder.user_id, false)
    return res.status(200).json({ success: true, shipment })
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 400
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to create reverse order',
    })
  }
}

export const createManualReverseOrderControllerAdmin = async (req: any, res: Response) => {
  try {
    const body = req.body || {}
    const merchantUserId = String(body?.userId || body?.user_id || '').trim()
    if (!merchantUserId) {
      return res.status(400).json({ success: false, message: 'Merchant user ID is required' })
    }

    const payload = {
      ...body,
      payment_type: 'reverse',
      isReverse: true,
      order_amount: Number(body?.order_amount ?? 0),
      prepaid_amount: Number(body?.prepaid_amount ?? 0),
      shipping_charges: Number(body?.shipping_charges ?? 0),
      freight_charges: Number(body?.freight_charges ?? 0),
      is_rto_different: body?.is_rto_different || 'no',
      request_auto_pickup: body?.request_auto_pickup || 'Yes',
      rto: body?.rto || body?.pickup,
      tags: [String(body?.tags || '').trim(), 'reverse_manual'].filter(Boolean).join(','),
    }

    const shipment = await createB2CShipmentService(payload, merchantUserId, false)
    return res.status(200).json({ success: true, shipment })
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 400
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to create manual reverse order',
    })
  }
}
