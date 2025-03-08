import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables from .env file
dotenv.config();

export const connect = async () => {
    const uri = process.env.DATA_CONNECTION;

    if (!uri) {
        console.error('No MongoDB connection string found in environment variables');
        return;
    }

    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
};