import mongoose from "mongoose";

const timelineItemSchema = new mongoose.Schema(
  {
    key: String,
    title: String,
    note: String,
    location: String,
    time: Date,
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPhone: String,
    originPincode: String,
    destinationPincode: String,
    destinationCity: String,
    courierPartner: String,
    paymentType: {
      type: String,
      enum: ["Prepaid", "COD"],
      default: "Prepaid",
    },
    weight: Number,
    dimensions: {
      length: Number,
      breadth: Number,
      height: Number,
    },
    price: Number,
    etaDays: Number,
    currentStatus: String,
    timeline: [timelineItemSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export const Shipment = mongoose.model("Shipment", shipmentSchema);
