import { EmbedField, Guild } from 'discord.js';
import { getUsersByPointsDesc } from './UserService';
import { formatDiscordUserTag } from './MessageHelpers';
import { convertNumberToEmoji } from './DropSubmissionService';
import { hasMemberRole } from '../utilities';
import { getLeaderboardAuditRecordsForTimePeriod } from './AuditService';

export const createAllTimePointsLeaderboard = async (guild?: Guild) => {
    if (!guild) {
        return {};
    }

    const usersWhoAreStillInServer = await getUsersStillInServer(guild);
    const topTenUsers = usersWhoAreStillInServer.slice(0, 20);
    const formatted = topTenUsers.map(
        (x, idx) => `${convertNumberToEmoji(idx + 1) ?? idx + 1} ${formatDiscordUserTag(x.discordId)}: ${x.points} points`
    );
    const test: EmbedField = { name: 'Top 20', value: formatted.join('\r\n\r\n'), inline: false };

    return {
        color: 0x8b0000,
        title: 'Iron Relax Leaderboard',
        description: 'Current clan point leaders',
        fields: [test]
    };
};

export const createTimePointsLeaderboard = async (startDate: string, endDate: string, guild?: Guild) => {
    if (!guild) {
        return {};
    }

    const leaderboardForTimePeriod = await getLeaderboardAuditRecordsForTimePeriod(startDate, endDate, 10);

    const formatted = leaderboardForTimePeriod.map(
        (x, idx) => `${convertNumberToEmoji(idx + 1) ?? idx + 1} ${formatDiscordUserTag(x.discordId)}: ${x.points} points`
    );

    const monthStringName = new Date().toLocaleString('en-US', { month: 'long' });
    const embed: EmbedField = { name: `Most points earned in ${monthStringName}`, value: formatted.join('\r\n\r\n'), inline: false };

    return {
        color: 0x8b0000,
        title: 'Iron Relax Leaderboard',
        description: `Most earned points for ${monthStringName}.`,
        fields: [embed]
    };
};

const getUsersStillInServer = async (guild: Guild) => {
    // db always tracks user but we only want to display users still in the discord server
    const users = await getUsersByPointsDesc();
    const members = await guild.members.fetch();
    return users.filter(async (x) => {
        try {
            const guildMember = members.find((y) => y.id === x.discordId);
            const currentGuildMember = await guildMember?.fetch(true);
            if (Boolean(currentGuildMember)) {
                return hasMemberRole(currentGuildMember);
            }
            return false;
        } catch (e) {
            return false;
        }
    });
};
