import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "./config/db.js";
import { Contact } from "./models/Contact.js";
import { Shipment } from "./models/Shipment.js";
import { Transaction } from "./models/Transaction.js";
import { User } from "./models/User.js";
import {
  buildSampleShipments,
  buildSampleTransactions,
  sampleContacts,
  sampleUsers,
} from "./utils/sampleData.js";

dotenv.config();

async function seed() {
  await connectDatabase(process.env.MONGODB_URI);

  await Promise.all([
    Contact.deleteMany({}),
    Transaction.deleteMany({}),
    Shipment.deleteMany({}),
    User.deleteMany({}),
  ]);

  const users = await Promise.all(sampleUsers.map((user) => User.create(user)));
  const shipments = await Shipment.insertMany(buildSampleShipments(users[0]._id));
  const transactions = buildSampleTransactions(shipments);

  await Transaction.insertMany(transactions);
  await Contact.insertMany(sampleContacts);

  console.log("Seed complete:", {
    users: users.length,
    shipments: shipments.length,
    transactions: transactions.length,
    contacts: sampleContacts.length,
  });

  await mongoose.connection.close();
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
