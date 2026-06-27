import { Router } from 'express'
import {
  addManualNdrToOrderControllerAdmin,
  createManualReverseOrderControllerAdmin,
  createReverseOrderControllerAdmin,
  escalateProviderOrderControllerAdmin,
  getAllOrdersControllerAdmin,
  getProviderPodControllerAdmin,
  quoteReverseOrderControllerAdmin,
  generateProviderQrControllerAdmin,
  exportOrdersControllerAdmin,
  regenerateOrderDocumentsControllerAdmin,
  updateOrderStatusControllerAdmin,
  updateProviderOrderControllerAdmin,
} from '../../controllers/admin/order.controller'
import { isAdminMiddleware } from '../../middlewares/isAdmin'
import { requireAuth } from '../../middlewares/requireAuth'
const router = Router()

router.get('/all-orders', requireAuth, isAdminMiddleware, getAllOrdersControllerAdmin)
router.get('/export', requireAuth, isAdminMiddleware, exportOrdersControllerAdmin)
router.post('/reverse/quote', requireAuth, isAdminMiddleware, quoteReverseOrderControllerAdmin)
router.post('/reverse/create', requireAuth, isAdminMiddleware, createReverseOrderControllerAdmin)
router.post('/reverse/manual', requireAuth, isAdminMiddleware, createManualReverseOrderControllerAdmin)
router.post('/:id/status', requireAuth, isAdminMiddleware, updateOrderStatusControllerAdmin)
router.post('/:id/ndr', requireAuth, isAdminMiddleware, addManualNdrToOrderControllerAdmin)
router.post('/:id/provider-update', requireAuth, isAdminMiddleware, updateProviderOrderControllerAdmin)
router.post('/:id/provider-escalate', requireAuth, isAdminMiddleware, escalateProviderOrderControllerAdmin)
router.post('/:id/provider-qr', requireAuth, isAdminMiddleware, generateProviderQrControllerAdmin)
router.get('/:id/provider-pod', requireAuth, isAdminMiddleware, getProviderPodControllerAdmin)
router.post(
  '/:id/regenerate-documents',
  requireAuth,
  isAdminMiddleware,
  regenerateOrderDocumentsControllerAdmin,
)
export default router
