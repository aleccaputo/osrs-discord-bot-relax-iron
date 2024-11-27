import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getRecentEndedCompetitionWithTopPlayers, getTopThreePlayersForCompetitionById } from '../services/CompetitionService';
import { modifyPoints } from '../services/UserService';
import { PointsAction } from '../services/DropSubmissionService';
import { PointType } from '../models/PointAudit';
import { formatDiscordUserTag } from '../services/MessageHelpers';

export const command = {
    data: new SlashCommandBuilder()
        .setName('rewardcompwinners')
        .setDescription('Reward the winners of a competition')
        .addIntegerOption((o) => o.setName('id').setDescription('the id of the competition in WOM').setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction) {
        const compId = interaction.options.getInteger('id');
        if (!interaction.guild) {
            await interaction.reply({ content: 'Error: This command must be run from within a server.', ephemeral: true });
            return;
        }
        const comp = compId
            ? await getTopThreePlayersForCompetitionById(interaction.guild, compId)
            : await getRecentEndedCompetitionWithTopPlayers(interaction.guild);

        console.log(comp);

        const winnerResponsesPromises = comp?.topPlayers.map(async (x) => {
            if (!x) {
                return 'Error: User not found';
            }
            const newPoints = await modifyPoints(x, 10, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
            return `${formatDiscordUserTag(x.discordId)} now has ${newPoints} points`;
        }) ?? [];

        const winningText = await Promise.all(winnerResponsesPromises);

        await interaction.reply(winningText.join('\n'));

        return;
    }
};