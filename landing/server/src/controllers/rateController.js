import { asyncHandler } from "../middleware/asyncHandler.js";
import { generateRateOptions } from "../services/rateEngine.js";

export const calculateRates = asyncHandler(async (req, res) => {
  const response = generateRateOptions(req.body);

  if (!response.summary.valid) {
    res.status(400);
    throw new Error("Please provide valid pincodes, weight, and dimensions.");
  }

  res.json(response);
});
