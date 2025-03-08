import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from 'discord.js';
import { blacklistUserByInGameName } from '../services/BlacklistService';
import { BlacklistRecordExistsException } from '../exceptions/BlacklistRecordExistsException';
import { isModRank } from '../utilities';

export const command = {
    data: new SlashCommandBuilder()
        .setName('pointblacklist')
        .addStringOption((o) => o.setName('name').setDescription('users osrs name').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('reason for blacklisting').setRequired(true))
        .setDescription('Blacklists a user by osrs name. That user will no longer earn points with the auto point system.'),
    async execute(interaction: ChatInputCommandInteraction) {
        const name = interaction.options.getString('name');
        const reason = interaction.options.getString('reason');
        const isMod = isModRank(interaction.member as GuildMember);

        await interaction.deferReply();

        if (!isMod) {
            await interaction.editReply({content: 'Insufficient privileges to run this command.'});
            return;
        }

        if (interaction.guild) {
            try {
                if (!name?.length) {
                    await interaction.editReply({content: 'Please enter a name'});
                    return;
                }
                if (!reason?.length) {
                    await interaction.editReply({content: 'Please enter a reason'});
                    return;
                }

                try {
                    await blacklistUserByInGameName(name, reason);
                    await interaction.editReply({content: 'User has been blacklisted'});
                    return;
                } catch (error: any) {
                    // Check if it's the specific error type
                    if (error instanceof BlacklistRecordExistsException) {
                        await interaction.editReply({content: 'User is already blacklisted'});
                        return;
                    } else {
                        console.error('unable to blacklist user', error);
                        await interaction.reply('Unable to blacklist user');
                        return;
                    }
                }
            } catch (e) {
                console.error('something went wrong with pointblacklist', e);
                await interaction.editReply({content: 'Something went wrong'});
                return;
            }
        } else {
            await interaction.editReply({content: 'This command must be run from within a server.'});
            return;
        }
    }
};
