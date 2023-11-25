import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createPointsLeaderboard } from '../services/RankService';

export const command = {
    data: new SlashCommandBuilder().setName('leaderboard').setDescription("See Iron Relax's current point leaders!"),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.reply('This command is still in development. Check back later!');
        /*        if (interaction.guild) {
            try {
                const embed = await createPointsLeaderboard(interaction.guild);
                await interaction.reply({embeds: [embed]});
                return;
            } catch (e) {
                console.error("unable to create leaderboard", e);
                return;
            }
        } else {
            await interaction.reply('There was a problem generating the leaderboard');
            return;
        }*/
    }
};
