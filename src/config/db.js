import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod = null;

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (mongoUri) {
      console.log('Connecting to MongoDB Atlas / Local...');
      await mongoose.connect(mongoUri);
      console.log(`MongoDB Connected to: ${mongoose.connection.host}`);
    } else {
      console.log('No MONGO_URI specified in environment. Starting MongoMemoryServer...');
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`MongoMemoryServer started at: ${uri}`);
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
    }
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongod) {
      await mongod.stop();
    }
    console.log('Database disconnected successfully.');
  } catch (error) {
    console.error(`Error disconnecting database: ${error.message}`);
  }
};
