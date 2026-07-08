import cors from "cors";
import express from "express";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import rateRoutes from "./routes/rateRoutes.js";
import shipmentRoutes from "./routes/shipmentRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") || "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Intlexpress API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/rates", rateRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/contacts", contactRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
