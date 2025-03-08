import { Schema, Document, model, Model } from 'mongoose';

export interface IBlacklist extends Document {
    id: string;
    inGameName: string;
    reason: string;
    additionalInformation: Map<string, string>
}

const BlacklistSchema = new Schema<IBlacklist>({
    inGameName: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    additionalInformation: {
        type: Map,
        of: String,
        required: false
    }
});

const Blacklist: Model<IBlacklist> = model('Blacklist', BlacklistSchema, 'Blacklist');

export default Blacklist
