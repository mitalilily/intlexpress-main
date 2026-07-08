import { Router } from "express";
import { body } from "express-validator";
import { createTransaction, listTransactions } from "../controllers/transactionController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.get("/", protect, authorize("admin", "manager"), listTransactions);
router.post(
  "/",
  protect,
  authorize("admin", "manager"),
  [body("shipment").notEmpty(), body("transactionId").trim().notEmpty(), body("amount").isNumeric()],
  validateRequest,
  createTransaction
);

export default router;
