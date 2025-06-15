import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from 'discord.js';
import { getUser, modifyNicknamePoints, modifyPoints } from '../services/UserService';
import { PointsAction } from '../services/DropSubmissionService';
import { formatDiscordUserTag } from '../services/MessageHelpers';
import { NicknameLengthException } from '../exceptions/NicknameLengthException';
import { isModRank } from '../utilities';
import { PointType } from '../models/PointAudit';

export const command = {
    data: new SlashCommandBuilder()
        .setName('modifypoints')
        .setDescription('add or subtract points for a user')
        .addUserOption((o) => o.setName('user').setDescription('the user to modify'))
        .addStringOption((o) =>
            o.setName('action').setDescription('add or subtract').addChoices(
                {
                    name: 'add',
                    value: '+'
                },
                { name: 'subtract', value: '-' }
            )
        )
        .addIntegerOption((o) => o.setName('points').setDescription('number of points to add or subtract'))
        .addStringOption((o) =>
            o
                .setName('type')
                .setDescription('type to classify these points. Defaults to manual')
                .addChoices({ name: 'ONE_TIME', value: 'ONE_TIME' })
                .setRequired(false)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        // why do i have to cast this. obnoxious
        const discordUser = interaction.options.getMember('user') as GuildMember | null;
        const action = interaction.options.getString('action');
        const points = interaction.options.getInteger('points');
        const type = interaction.options.getString('type');
        const isMod = isModRank(interaction.member as GuildMember);

        if (!isMod) {
            await interaction.reply('Insufficient privileges to run this command.');
            return;
        }

        if (discordUser && points && action && discordUser && isMod) {
            try {
                const user = discordUser?.id ? await getUser(discordUser?.id) : null;
                const newPoints = await modifyPoints(
                    user,
                    points,
                    action === '+' ? PointsAction.ADD : PointsAction.SUBTRACT,
                    (interaction.member as GuildMember).id,
                    type ? PointType[type as keyof typeof PointType] : PointType.MANUAL,
                    // TODO this isnt actually a message id. see rewardcompwinners for details
                    interaction.id
                );
                if (newPoints) {
                    await interaction.reply(`${formatDiscordUserTag(discordUser.id)} now has ${newPoints} points`);
                    try {
                        await modifyNicknamePoints(newPoints, discordUser);
                    } catch (e) {
                        console.log(e);
                        if (e instanceof NicknameLengthException) {
                            await interaction.reply(
                                'Nickname is either too long or will be too long. Must be less than or equal to 32 characters.'
                            );
                            return;
                        } else {
                            await interaction.reply(`Unable to set points or modify nickname for <@${discordUser?.id}>`);
                            return;
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            await interaction.reply('Command Malformed');
            return;
        }
    }
};
