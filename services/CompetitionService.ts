import { getCompetitionById, getGroupCompetitions } from './WiseOldManService';
import { getUserByDiscordNickname, modifyNicknamePoints, modifyPoints } from './UserService';
import { Guild, Interaction } from 'discord.js';
import { PointsAction } from './DropSubmissionService';
import { PointType } from '../models/PointAudit';
import { formatDiscordUserTag } from './MessageHelpers';
import { CompetitionDetails } from '@wise-old-man/utils';
import { IUser } from '../models/User';
import { ObjectId } from 'mongoose';
import { IRewardCompWinnersParameters } from '../commands/rewardcompwinners';

interface IPlayersAndCompetition {
    competition: CompetitionDetails;
    sortedGainedPlayers: ((IUser & { _id: ObjectId }) | null)[]
}
export const getRecentEndedCompetitionSortedAndGained = async (guild: Guild, threshold: number) => {
    const competitions = await getGroupCompetitions();
    const now = new Date();
    
    if(!competitions) {
        return null;
    }

    // Filter competitions that have ended
    const endedCompetitions = competitions.filter((comp) => new Date(comp.endsAt) < now);

    // Sort competitions by end date in descending order to get the most recent one
    const sortedCompetitions = endedCompetitions.sort(
        (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime()
    );

    if (sortedCompetitions.length === 0) {
        return null;
    }

    const recentEndedCompetition = sortedCompetitions[0];

    return getCompParticipantsSorted(guild, recentEndedCompetition.id, threshold);
};


export const getCompParticipantsSorted = async (guild: Guild, competitionId: number, threshold: number) => {
    const fullCompDetails = await getCompetitionById(competitionId);
    console.warn(fullCompDetails);
    const sortedGainedPlayers = fullCompDetails.participations
        .filter(x => x.progress.gained > threshold)
        .sort((a, b) => b.progress.gained - a.progress.gained)

    const guildMembers = await guild.members.fetch();
    const users = await Promise.all(sortedGainedPlayers.map(x => getUserByDiscordNickname(guildMembers, x.player.displayName)));

    return {
        competition: fullCompDetails,
        sortedGainedPlayers: users
    } as IPlayersAndCompetition;
}

export const createWinnersResponseMessage = (comp: IPlayersAndCompetition | null, parameters: IRewardCompWinnersParameters, interaction: Interaction) => {
    const {firstPlacePoints, secondPlacePoints, thirdPlacePoints, participantPoints} = parameters;
    return comp?.sortedGainedPlayers.map(async (x, idx) => {
        if (!x) {
            return 'Error: User not found in DB';
        }

        const member = await interaction?.guild?.members.fetch(x.discordId);

        if (!member) {
            return 'Error: User not found in discord';
        }

        let newPoints: number | null;
        let pointsAdded: number | null;

        switch (idx) {
            case 0:
                newPoints = await modifyPoints(x, parameters.firstPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
                pointsAdded = firstPlacePoints;
                break;
            case 1:
                newPoints = await modifyPoints(x, secondPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
                pointsAdded = secondPlacePoints;
                break;
            case 2:
                newPoints = await modifyPoints(x, thirdPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
                pointsAdded = thirdPlacePoints;
                break;
            default:
                newPoints = await modifyPoints(x, participantPoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
                pointsAdded = participantPoints;
                break;
        }
        await modifyNicknamePoints(newPoints ?? 0, member)

        return `${formatDiscordUserTag(x.discordId)} has been given ${pointsAdded} points and now has ${newPoints} points.`;
    }) ?? [];
}
