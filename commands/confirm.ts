import {ChannelType, ChatInputCommandInteraction, GuildMember, SlashCommandBuilder} from "discord.js";
import {createUser} from "../services/UserService";
import {UserExistsException} from "../exceptions/UserExistsException";
import {isModRank} from "../utilities";

export const command = {
    data: new SlashCommandBuilder()
        .setName('confirm')
        .setDescription('confirm and accept a trial member\'s application.')
        .addUserOption(o => o.setName('user')
            .setDescription('the user to confirm')),
    async execute(interaction: ChatInputCommandInteraction) {
        const discordUser = interaction.options.getMember('user') as GuildMember | null;
        const isMod = isModRank(interaction.member as GuildMember);
        if (!isMod) {
            await interaction.reply('Insufficient privileges to run this command.');
            return;
        }

        if (interaction.channel?.id !== process.env.AWAITING_APPROVAL_CHANNEL_ID) {
            await interaction.reply('This command can only be run from the awaiting approval channel');
            return;
        }

        if (process.env.NOT_IN_CLAN_ROLE_ID && process.env.RANK_ONE_ID && process.env.VERIFIED_ROLE_ID) {
            await discordUser?.roles.add([process.env.RANK_ONE_ID, process.env.VERIFIED_ROLE_ID]);
            await discordUser?.roles.remove(process.env.NOT_IN_CLAN_ROLE_ID);
            const usernameWithoutSpaces = discordUser?.user?.username.replace(/[\W_]/g, '').toLocaleLowerCase();
            const applicationChannel = interaction.guild?.channels.cache.find(x => x.name === `application-${usernameWithoutSpaces}`);

            if (applicationChannel) {
                await applicationChannel.delete()
            }

            const ign = discordUser?.nickname;
            try {
                await createUser(discordUser);
            } catch (e) {
                if (process.env.REPORTING_CHANNEL_ID) {
                    const reportingChannel = interaction.guild?.channels.cache.get(process.env.REPORTING_CHANNEL_ID);
                    if (reportingChannel && reportingChannel.type === ChannelType.GuildText) {
                        if (e instanceof UserExistsException) {
                            await reportingChannel.send(`<@${discordUser?.id}> is already a user in the system (potential server re-join). Please ensure their discord profile is set correctly.`);
                            await interaction.reply('Error. Please check the mod channel for more details');
                            return;
                        } else {
                            await reportingChannel.send(`Unable to add <@${discordUser?.id}> as a user. Please contact a developer`);
                            await interaction.reply('Error. Please check the mod channel for more details');
                            return;
                        }
                    }
                }
            }
/*          TODO WOM
            if (ign) {
                const response = await addMemberToWiseOldMan(ign);
                if (!response) {
                    console.log("unable to add user to WOM");
                }
            } */
            await interaction.reply(`<@${discordUser?.id}> successfully added!`);
        }
    }
};