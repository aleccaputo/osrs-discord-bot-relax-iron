import { Schema, Document, model, Model } from 'mongoose';

export enum PointType {
    MANUAL = 'MANUAL',
    REACTION = 'REACTION',
    AUTOMATED = 'AUTOMATED'
}

export interface IPointAudit extends Document {
    id: string;
    createdAt: string;
    sourceDiscordId: string;
    destinationDiscordId: string;
    pointsGiven: number;
    type: PointType;
    messageId: string;
}

const PointAuditSchema = new Schema<IPointAudit>({
    createdAt: {
        type: String,
        required: true
    },
    sourceDiscordId: {
        type: String,
        required: true
    },
    destinationDiscordId: {
        type: String,
        required: true
    },
    pointsGiven: {
        type: Number,
        required: true,
        default: 0
    },
    type: {
        type: String,
        required: true
    },
    messageId: {
        type: String,
        required: true
    }
});

const PointAudit: Model<IPointAudit> = model('PointAudit', PointAuditSchema, 'PointAudit');

export default PointAudit;
