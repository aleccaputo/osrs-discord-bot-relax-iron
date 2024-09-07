import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createAllTimePointsLeaderboard, createTimePointsLeaderboard } from '../services/LeaderboardService';

export const command = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .addStringOption((o) =>
            o.setName('time').setDescription('time period').addChoices({ name: 'month', value: 'month' }, { name: 'all', value: 'all' })
        )
        .setDescription("See Iron Relax's current point leaders!"),
    async execute(interaction: ChatInputCommandInteraction) {
        const time = interaction.options.getString('time');
        if (interaction.guild) {
            try {
                if (time === 'all') {
                    const embed = await createAllTimePointsLeaderboard(interaction.guild);
                    await interaction.reply({ embeds: [embed] });
                    return;
                }

                const today = new Date();
                const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const embed = await createTimePointsLeaderboard(firstOfMonth.toISOString(), today.toISOString(), interaction.guild);
                await interaction.reply({ embeds: [embed] });
                return;
            } catch (e) {
                console.error('unable to create leaderboard', e);
                return;
            }
        } else {
            await interaction.reply('There was a problem generating the leaderboard');
            return;
        }
    }
};
