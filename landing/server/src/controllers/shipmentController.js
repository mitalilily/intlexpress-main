import { Shipment } from "../models/Shipment.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const listShipments = asyncHandler(async (req, res) => {
  const shipments = await Shipment.find().sort({ createdAt: -1 }).populate("createdBy", "name email role");
  res.json({ count: shipments.length, shipments });
});

export const getShipmentByTracking = asyncHandler(async (req, res) => {
  const shipment = await Shipment.findOne({
    trackingId: req.params.trackingId.toUpperCase(),
  }).populate("createdBy", "name email role");

  if (!shipment) {
    res.status(404);
    throw new Error("Shipment not found.");
  }

  res.json(shipment);
});

export const createShipment = asyncHandler(async (req, res) => {
  const shipment = await Shipment.create({
    ...req.body,
    trackingId: req.body.trackingId.toUpperCase(),
    createdBy: req.user._id,
  });

  res.status(201).json(shipment);
});

export const updateShipmentStatus = asyncHandler(async (req, res) => {
  const shipment = await Shipment.findById(req.params.id);

  if (!shipment) {
    res.status(404);
    throw new Error("Shipment not found.");
  }

  shipment.currentStatus = req.body.currentStatus;
  shipment.timeline.push({
    key: req.body.key,
    title: req.body.title,
    note: req.body.note,
    location: req.body.location,
    time: new Date(),
  });

  await shipment.save();

  res.json(shipment);
});
