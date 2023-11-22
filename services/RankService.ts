import {EmbedField, Guild} from "discord.js";
import {getUsersByPointsDesc} from "./UserService";
import {formatDiscordUserTag} from "./MessageHelpers";
import {convertNumberToEmoji} from "./DropSubmissionService";
import {hasMemberRole} from "../utilities";

export const createPointsLeaderboard = async (guild?: Guild) => {
    if (!guild) {
        return {};
    }
    // db always tracks user but we only want to display users still in the discord server
    const users = await getUsersByPointsDesc();
    const members = await guild.members.fetch();
    const usersWhoAreStillInServer = users.filter(async (x) => {
        try {
            const guildMember = members.find(y => y.id === x.discordId);
            const currentGuildMember = await guildMember?.fetch(true);
            if (Boolean(currentGuildMember)) {
                return hasMemberRole(currentGuildMember);
            }
            return false;
        } catch (e) {
            return false;
        }
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