import PointAudit, { PointType } from '../models/PointAudit';
import { PointsAction } from './DropSubmissionService';
import dayjs from 'dayjs';

interface AuditLeaderboardModel {
    discordId: string;
    points: number;
}

export const auditPoints = async (
    sourceDiscordId: string,
    destinationDiscordId: string,
    points: number,
    type: PointType,
    action: PointsAction,
    messageId: string
) => {
    await new PointAudit({
        createdAt: dayjs(new Date().toUTCString()).toISOString(),
        sourceDiscordId: sourceDiscordId,
        destinationDiscordId: destinationDiscordId,
        pointsGiven: action === PointsAction.ADD ? points : -Math.abs(points),
        type: type,
        messageId: messageId
    }).save();
};

export const getLeaderboardAuditRecordsForTimePeriod = async (startDate: string, endDate: string) => {
    const records = await PointAudit.find({
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    });

    // Reduce the results to sum points by destinationDiscordId
    const pointsByDiscordId = records.reduce(
        (acc, { destinationDiscordId, pointsGiven }) => {
            acc[destinationDiscordId] = (acc[destinationDiscordId] || 0) + pointsGiven;
            return acc;
        },
        {} as Record<string, number>
    );

    const sortedLeaderboard: AuditLeaderboardModel[] = Object.entries(pointsByDiscordId)
        .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
        .map(([discordId, points]) => ({ discordId, points }));

    return sortedLeaderboard;
};
