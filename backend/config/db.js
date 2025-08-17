import { PrismaClient } from '@prisma/client';

console.log('DATABASE_URL:', process.env.DATABASE_URL);
export const prisma = new PrismaClient();

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Connected to Azure SQL Database");
  } catch (err) {
    console.error("❌ Error connecting to database:", err.message);
    throw err;
  }
};