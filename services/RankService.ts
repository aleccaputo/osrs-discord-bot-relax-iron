import {EmbedField, Guild} from "discord.js";
import {getUsersByPointsDesc} from "./UserService";
import {formatDiscordUserTag} from "./MessageHelpers";
import {convertNumberToEmoji} from "./DropSubmissionService";

export const createPointsLeaderboard = async (guild?: Guild) => {
    if (!guild) {
        return {};
    }
    // db always tracks user but we only want to display users still in the discord server
    const users = await getUsersByPointsDesc();
    const usersWhoAreStillInServer = users.filter(x => {
        const guildMember = guild.members.cache.get(x.discordId);
        return Boolean(guildMember);
    })
    const topTenUsers = usersWhoAreStillInServer.slice(0, 20);
    const formatted = topTenUsers.map((x, idx) => `${convertNumberToEmoji(idx + 1) ?? idx + 1} ${formatDiscordUserTag(x.discordId)}: ${x.points} points`)
    const test: EmbedField = {name: 'Top 20', value: formatted.join('\r\n\r\n'), inline: false}

    return {
        color: 0x8b0000,
        title: 'Iron Relax Leaderboard',
        description: 'Current clan point leaders',
        fields: [test]
    };
}