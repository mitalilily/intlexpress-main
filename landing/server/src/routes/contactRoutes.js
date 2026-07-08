import { Router } from "express";
import { body } from "express-validator";
import { createContact, listContacts } from "../controllers/contactController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.post(
  "/",
  [
    body("name").trim().notEmpty(),
    body("email").isEmail().normalizeEmail(),
    body("message").trim().notEmpty(),
  ],
  validateRequest,
  createContact
);

router.get("/", protect, authorize("admin", "manager"), listContacts);

export default router;
