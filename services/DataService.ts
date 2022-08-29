import * as dotenv from "dotenv";
import mongoose from 'mongoose';
dotenv.config();

export const connect = async () => {
    const uri = process.env.DATA_CONNECTION;
    try {
        mongoose.connect(process.env.DATA_CONNECTION ?? '', { }, () => console.log('connected to db'));
    } catch (e) {
        console.log('error connecting to db')
    }
}