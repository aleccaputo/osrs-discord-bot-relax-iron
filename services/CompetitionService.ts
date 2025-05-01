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
import { NicknameLengthException } from '../exceptions/NicknameLengthException';

interface IPlayersAndCompetition {
    competition: CompetitionDetails;
    sortedGainedPlayers: {user: (IUser & {_id: ObjectId}) | null, displayName: string}[]
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
        .filter(x => x.progress.gained >= threshold)
        .sort((a, b) => b.progress.gained - a.progress.gained)

    const guildMembers = await guild.members.fetch();
    const usersAndDisplay = await Promise.all(sortedGainedPlayers.map(async x => {
        const user = await getUserByDiscordNickname(guildMembers, x.player.displayName);
        return {
            user,
            displayName: x.player.displayName
        }
    }));

    return {
        competition: fullCompDetails,
        sortedGainedPlayers: usersAndDisplay
    } as IPlayersAndCompetition;
}

export const createWinnersResponseMessage = (comp: IPlayersAndCompetition | null, parameters: IRewardCompWinnersParameters, interaction: Interaction, messageId: string) => {
    const {firstPlacePoints, secondPlacePoints, thirdPlacePoints, participantPoints} = parameters;
    return comp?.sortedGainedPlayers.map(async (x, idx) => {
        if (!x.user) {
            return `Error: User with in game name ${x.displayName} not found in DB`;
        }

        const member = await interaction?.guild?.members.fetch(x.user.discordId);

        if (!member) {
            return 'Error: User not found in discord';
        }

        let newPoints: number | null;
        let pointsAdded: number | null;

        switch (idx) {
            case 0:
                newPoints = await modifyPoints(x.user, parameters.firstPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, messageId);
                pointsAdded = firstPlacePoints;
                break;
            case 1:
                newPoints = await modifyPoints(x.user, secondPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, messageId);
                pointsAdded = secondPlacePoints;
                break;
            case 2:
                newPoints = await modifyPoints(x.user, thirdPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, messageId);
                pointsAdded = thirdPlacePoints;
                break;
            default:
                newPoints = await modifyPoints(x.user, participantPoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, messageId);
                pointsAdded = participantPoints;
                break;
        }

        try {
            await modifyNicknamePoints(newPoints ?? 0, member)

            return `${formatDiscordUserTag(x.user.discordId)} has been given ${pointsAdded} points and now has ${newPoints} points.`;
        } catch (e) {
            if (e instanceof NicknameLengthException) {
                return `WARNING! Nickname too long for user, unable to modify nickname but: ${formatDiscordUserTag(x.user.discordId)} has been given ${pointsAdded} points and now has ${newPoints} points.`;
            }
            throw e;
        }
    }) ?? [];
}
