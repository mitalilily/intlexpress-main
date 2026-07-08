import { Transaction } from "../models/Transaction.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const listTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find()
    .sort({ createdAt: -1 })
    .populate("shipment", "trackingId orderId courierPartner currentStatus");

  res.json({ count: transactions.length, transactions });
});

export const createTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.create(req.body);
  res.status(201).json(transaction);
});
