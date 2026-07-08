import { Router } from "express";
import { body } from "express-validator";
import {
  createShipment,
  getShipmentByTracking,
  listShipments,
  updateShipmentStatus,
} from "../controllers/shipmentController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.get("/", protect, listShipments);
router.get("/tracking/:trackingId", getShipmentByTracking);
router.post(
  "/",
  protect,
  authorize("admin", "manager"),
  [
    body("trackingId").trim().notEmpty(),
    body("orderId").trim().notEmpty(),
    body("customerName").trim().notEmpty(),
  ],
  validateRequest,
  createShipment
);
router.patch(
  "/:id/status",
  protect,
  authorize("admin", "manager"),
  [body("currentStatus").trim().notEmpty(), body("title").trim().notEmpty()],
  validateRequest,
  updateShipmentStatus
);

export default router;
