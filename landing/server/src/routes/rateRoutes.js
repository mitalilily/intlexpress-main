import { Router } from "express";
import { body } from "express-validator";
import { calculateRates } from "../controllers/rateController.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.post(
  "/calculate",
  [
    body("originPincode").trim().notEmpty(),
    body("destinationPincode").trim().notEmpty(),
    body("weight").notEmpty(),
    body("length").notEmpty(),
    body("breadth").notEmpty(),
    body("height").notEmpty(),
  ],
  validateRequest,
  calculateRates
);

export default router;
