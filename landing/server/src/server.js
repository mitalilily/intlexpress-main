import dotenv from "dotenv";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";

dotenv.config();

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  await connectDatabase(process.env.MONGODB_URI);

  app.listen(PORT, () => {
    console.log(`Intlexpress API listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
