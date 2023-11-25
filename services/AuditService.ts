import PointAudit, { PointType } from '../models/PointAudit';
import { PointsAction } from './DropSubmissionService';
import dayjs from 'dayjs';

export const auditPoints = async (
    sourceDiscordId: string,
    destinationDiscordId: string,
    points: number,
    type: PointType,
    action: PointsAction
) => {
    await new PointAudit({
        createdAt: dayjs(new Date().toUTCString()).toISOString(),
        sourceDiscordId: sourceDiscordId,
        destinationDiscordId: destinationDiscordId,
        pointsGiven: action === PointsAction.ADD ? points : -Math.abs(points),
        type: type
    }).save();
};
