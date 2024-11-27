import { getCompetitionById, getGroupCompetitions } from './WiseOldManService';
import { getUserByDiscordNickname } from './UserService';
import { Guild } from 'discord.js';

export const getRecentEndedCompetitionWithTopPlayers = async (guild: Guild) => {
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

    return getTopThreePlayersForCompetitionById(guild, recentEndedCompetition.id);
};


export const getTopThreePlayersForCompetitionById = async (guild: Guild, competitionId: number) => {
    const fullCompDetails = await getCompetitionById(competitionId);
    console.warn(fullCompDetails);
    const topPlayers = fullCompDetails.participations
        .sort((a, b) => b.progress.gained - a.progress.gained)
        .slice(0, 3);

    const guildMembers = await guild.members.fetch();
    const [first, second, third] = await Promise.all(topPlayers.map(x => getUserByDiscordNickname(guildMembers, x.player.displayName)));

    return {
        competition: fullCompDetails,
        topPlayers: [first, second, third]
    };
}
