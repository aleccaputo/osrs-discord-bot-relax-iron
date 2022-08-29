import {Schema, Document, model, Model} from 'mongoose';

export interface IUser extends Document{
    id: string;
    discordId: string;
    points: number;
    joined: string;
}

const UserSchema = new Schema<IUser>({
    discordId: {
        type: String,
        required: true,
    },
    joined: {
        type: String,
        required: true,
    },
    points: {
        type: Number,
        required: true,
        default: 0
    }
});

const User: Model<IUser> = model('User', UserSchema, 'Users');

export default User;