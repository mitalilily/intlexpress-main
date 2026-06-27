import { and, eq, inArray } from 'drizzle-orm'
import { Response } from 'express'
import { db } from '../../models/client'
import { DelhiveryService } from '../../models/services/couriers/delhivery.service'
import { getNdrTimeline, listNdrEvents } from '../../models/services/ndr.service'
import { recordNdrEvent } from '../../models/services/ndr.service'
import { b2c_orders } from '../../schema/schema'

const normalizeOptionalString = (value: unknown) => {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : undefined
}

const hasDelhiveryActionAccepted = (resp: any): boolean => {
  if (!resp) return false
  if (resp.success === true || resp.Success === true || resp.status === true) return true

  const status = String(resp.status || resp.Status || '').toLowerCase()
  if (status.includes('success') || status.includes('accepted') || status.includes('queued')) {
    return true
  }

  const message = String(resp.message || resp.remark || '').toLowerCase()
  if (message.includes('success') || message.includes('accepted') || message.includes('queued')) {
    return true
  }

  if (resp.upl || resp.upl_id || resp.Upl || resp.UPL) return true

  if (Array.isArray(resp.data) && resp.data.length > 0) {
    return resp.data.every((item: any) => {
      if (item?.success === true || item?.status === true) return true
      const s = String(item?.status || item?.Status || '').toLowerCase()
      const m = String(item?.message || item?.remark || '').toLowerCase()
      return (
        s.includes('success') ||
        s.includes('accepted') ||
        s.includes('queued') ||
        m.includes('success') ||
        m.includes('accepted') ||
        m.includes('queued')
      )
    })
  }

  return false
}

const normalizeDelhiveryNdrActions = (payload: any) => {
  const rawItems = Array.isArray(payload?.data)
    ? payload.data
    : payload?.waybill || payload?.act
      ? [payload]
      : []

  return rawItems
    .map((item: any) => {
      const waybill = normalizeOptionalString(item?.waybill)
      const act = normalizeOptionalString(item?.act)?.toUpperCase()

      if (!waybill || !act) return null
      if (!['RE-ATTEMPT', 'PICKUP_RESCHEDULE'].includes(act)) return null

      const actionData = {
        ...(item?.action_data && typeof item.action_data === 'object' ? item.action_data : {}),
      } as Record<string, any>

      const deferredDate =
        normalizeOptionalString(item?.deferred_date) ||
        normalizeOptionalString(item?.deferment_date) ||
        normalizeOptionalString(item?.defermentDate)
      if (deferredDate) {
        actionData.deferred_date = deferredDate
      }

      return {
        waybill,
        act: act as 'RE-ATTEMPT' | 'PICKUP_RESCHEDULE',
        ...(Object.keys(actionData).length ? { action_data: actionData } : {}),
      }
    })
    .filter(Boolean) as Array<{
    waybill: string
    act: 'RE-ATTEMPT' | 'PICKUP_RESCHEDULE'
    action_data?: Record<string, any>
  }>
}

const normalizeBooleanQuery = (value: unknown, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value

  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return fallback
}

/**
 * Get NDR events
 * GET /api/v1/ndr
 */
export const getNdrEventsController = async (req: any, res: Response) => {
  try {
    const userId = req.userId
    const { orderId, page, limit, search, fromDate, toDate } = req.query as any

    const p = Math.max(Number(page) || 1, 1)
    const l = Math.min(Number(limit) || 20, 200)

    const { rows, totalCount } = await listNdrEvents(userId, orderId, {
      page: p,
      limit: l,
      search: search || '',
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: p,
        limit: l,
        total: totalCount,
        totalPages: Math.ceil(totalCount / l),
      },
    })
  } catch (error: any) {
    console.error('Error fetching NDR events via API:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NDR events',
      message: error.message || 'Internal server error',
    })
  }
}

/**
 * Submit Delhivery NDR actions
 * POST /api/v1/ndr
 */
export const submitDelhiveryNdrActionController = async (req: any, res: Response) => {
  try {
    const userId = String(req.userId || '').trim()
    const actions = normalizeDelhiveryNdrActions(req.body || {})

    if (!actions.length) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid payload',
        message:
          "Provide either { waybill, act } or { data: [{ waybill, act }] } with act as 'RE-ATTEMPT' or 'PICKUP_RESCHEDULE'",
      })
    }

    const waybills = Array.from(new Set(actions.map((action) => action.waybill)))
    const orders = await db
      .select()
      .from(b2c_orders)
      .where(and(eq(b2c_orders.user_id, userId), inArray(b2c_orders.awb_number, waybills)))

    const orderByAwb = new Map(orders.map((order) => [String(order.awb_number || '').trim(), order]))
    const missingWaybills = waybills.filter((waybill) => !orderByAwb.has(waybill))
    if (missingWaybills.length > 0) {
      return res.status(404).json({
        success: false,
        error: 'Orders not found',
        message: 'One or more waybills were not found for this merchant',
        data: {
          missing_waybills: missingWaybills,
        },
      })
    }

    const unsupportedOrder = actions.find((action) => {
      const order = orderByAwb.get(action.waybill)
      return String(order?.integration_type || '').trim().toLowerCase() !== 'delhivery'
    })
    if (unsupportedOrder) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported provider',
        message: `Waybill ${unsupportedOrder.waybill} is not configured for Delhivery`,
      })
    }

    const actionsByGroup = new Map<
      string,
      {
        order: typeof orders[number]
        actions: typeof actions
      }
    >()

    for (const action of actions) {
      const order = orderByAwb.get(action.waybill)!
      const pickupDetails =
        order.pickup_details && typeof order.pickup_details === 'object'
          ? (order.pickup_details as Record<string, any>)
          : {}
      const providerMeta =
        order.provider_meta && typeof order.provider_meta === 'object'
          ? (order.provider_meta as Record<string, any>)
          : {}
      const accountCode =
        normalizeOptionalString(providerMeta.delhivery_account_code) ||
        normalizeOptionalString(providerMeta.delhiveryAccountCode) ||
        ''
      const pickupLocationName =
        normalizeOptionalString(pickupDetails.warehouse_name) ||
        normalizeOptionalString(order.pickup_location_id) ||
        ''
      const groupKey = `${accountCode}__${pickupLocationName}`
      const existing = actionsByGroup.get(groupKey)
      if (existing) {
        existing.actions.push(action)
      } else {
        actionsByGroup.set(groupKey, {
          order,
          actions: [action],
        })
      }
    }

    const providerResponses: Array<{
      action_count: number
      waybills: string[]
      response: any
    }> = []

    for (const group of actionsByGroup.values()) {
      const delhivery = new DelhiveryService({ order: group.order })
      const providerResponse = await delhivery.submitNdrAction(group.actions)

      if (!hasDelhiveryActionAccepted(providerResponse)) {
        return res.status(502).json({
          success: false,
          error: 'Courier action rejected',
          message: 'Delhivery did not accept one or more NDR actions',
          data: {
            provider: 'delhivery',
            waybills: group.actions.map((action) => action.waybill),
            provider_response: providerResponse,
          },
        })
      }

      providerResponses.push({
        action_count: group.actions.length,
        waybills: group.actions.map((action) => action.waybill),
        response: providerResponse,
      })
    }

    for (const action of actions) {
      const order = orderByAwb.get(action.waybill)
      if (!order) continue

      await recordNdrEvent({
        orderId: order.id,
        userId: order.user_id,
        awbNumber: action.waybill,
        status: 'ndr_action',
        remarks: action.act,
        payload: {
          provider: 'delhivery',
          action: action.act,
          action_data: action.action_data || null,
          source: 'external_api',
        },
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        provider: 'delhivery',
        actions,
        responses: providerResponses,
      },
    })
  } catch (error: any) {
    console.error('Error submitting Delhivery NDR action via API:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to submit NDR action',
      message: error?.message || 'Internal server error',
    })
  }
}

/**
 * Get Delhivery NDR UPL status
 * GET /api/v1/ndr/status
 */
export const getDelhiveryNdrStatusController = async (req: any, res: Response) => {
  try {
    const uplId =
      normalizeOptionalString(req.query?.uplId) ||
      normalizeOptionalString(req.query?.request_id) ||
      normalizeOptionalString(req.query?.requestId)

    if (!uplId) {
      return res.status(400).json({
        success: false,
        error: 'Missing upl id',
        message: 'Provide uplId or request_id',
      })
    }

    const verbose = normalizeBooleanQuery(req.query?.verbose, true)
    const delhivery = new DelhiveryService()
    const data = await delhivery.getNdrStatus(uplId, verbose)

    return res.status(200).json({
      success: true,
      data,
      request: {
        provider: 'delhivery',
        uplId,
        verbose,
      },
    })
  } catch (error: any) {
    console.error('Error fetching Delhivery NDR status via API:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch NDR status',
      message: error?.message || 'Internal server error',
    })
  }
}

/**
 * Get NDR timeline for an order
 * GET /api/v1/ndr/timeline
 */
export const getNdrTimelineController = async (req: any, res: Response) => {
  try {
    const { awb, orderId } = req.query as { awb?: string; orderId?: string }

    if (!awb && !orderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'Provide either awb or orderId',
      })
    }

    const data = await getNdrTimeline({ awb, orderId })

    res.status(200).json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Error fetching NDR timeline via API:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NDR timeline',
      message: error.message || 'Internal server error',
    })
  }
}
