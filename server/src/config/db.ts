import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ MongoDB connection error: ${message}`);
    process.exit(1);
  }
};

export default connectDB;
