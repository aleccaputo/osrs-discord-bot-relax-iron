import {EmbedField} from "discord.js";
import {getUsersByPointsDesc} from "./UserService";
import {formatDiscordUserTag} from "./MessageHelpers";
import {convertNumberToEmoji} from "./DropSubmissionService";

export const createPointsLeaderboard = async () => {
    const users = await getUsersByPointsDesc();
    const topTenUsers = users.slice(0, 20);
    const formatted = topTenUsers.map((x, idx) => `${convertNumberToEmoji(idx + 1) ?? idx + 1} ${formatDiscordUserTag(x.discordId)}: ${x.points} points`)
    const test: EmbedField = {name: 'Top 20', value: formatted.join('\r\n\r\n'), inline: false};

    return {
        color: 0x8b0000,
        title: 'Iron Relax Leaderboard',
        description: 'Current clan point leaders',
        fields: [test]
    };
}