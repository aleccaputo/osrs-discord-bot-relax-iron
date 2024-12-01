import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from 'discord.js';
import { getRecentEndedCompetitionSortedAndGained, getCompParticipantsSorted } from '../services/CompetitionService';
import { modifyNicknamePoints, modifyPoints } from '../services/UserService';
import { PointsAction } from '../services/DropSubmissionService';
import { PointType } from '../models/PointAudit';
import { formatDiscordUserTag, splitMessage } from '../services/MessageHelpers';
import { isModRank } from '../utilities';

export const command = {
    data: new SlashCommandBuilder()
        .setName('rewardcompwinners')
        .setDescription('Reward the winners of a competition')
        .addIntegerOption((o) => o.setName('firstpoints').setDescription('points to give to first place').setRequired(true))
        .addIntegerOption((o) => o.setName('secondpoints').setDescription('points to give to second place').setRequired(true))
        .addIntegerOption((o) => o.setName('thirdpoints').setDescription('points to give to third place').setRequired(true))
        .addIntegerOption((o) => o.setName('participantpoints').setDescription('points to give to everyone else that participated').setRequired(true))
        .addIntegerOption((o) => o.setName('threshold').setDescription('value threshold for XP or KC. Make sure you know the competition. Defaults to > 0.').setRequired(true))
        .addIntegerOption((o) => o.setName('id').setDescription('the id of the competition in WOM').setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction) {
        const compId = interaction.options.getInteger('id');
        const firstPlacePoints = interaction.options.getInteger('firstpoints') ?? 0;
        const secondPlacePoints = interaction.options.getInteger('secondpoints') ?? 0;
        const thirdPlacePoints = interaction.options.getInteger('thirdpoints') ?? 0;
        const threshold = interaction.options.getInteger('threshold') ?? 0;
        const participantPoints = interaction.options.getInteger('participantpoints') ?? 0;

        const isMod = isModRank(interaction.member as GuildMember);
        await interaction.deferReply();
        if (!isMod) {
            await interaction.editReply({content: 'Insufficient privileges to run this command.'});
            return;
        }

        if (!interaction.guild) {
            await interaction.editReply({ content: 'Error: This command must be run from within a server.' });
            return;
        }

        if (!firstPlacePoints || !secondPlacePoints || !thirdPlacePoints || !participantPoints) {
            await interaction.editReply({ content: 'Error: 1st, 2nd, 3rd, and participant points must be specified' });
        }
        const comp = compId
            ? await getCompParticipantsSorted(interaction.guild, compId, threshold)
            : await getRecentEndedCompetitionSortedAndGained(interaction.guild, threshold);

        console.log(comp);
        await interaction.editReply(`Please wait while I calculate points for ${comp?.competition.title} (Id: ${comp?.competition.id}) in the background...`);

        const winnerResponsesPromises = comp?.sortedGainedPlayers.map(async (x, idx) => {
            if (!x) {
                return 'Error: User not found in DB';
            }

            const member = await interaction?.guild?.members.fetch(x.discordId);

            if (!member) {
                return 'Error: User not found in discord';
            }

            let newPoints: number | null;
            let pointsAdded: number | null;

            switch (idx) {
                case 0:
                    newPoints = await modifyPoints(x, firstPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
                    pointsAdded = firstPlacePoints;
                    break;
                case 1:
                    newPoints = await modifyPoints(x, secondPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
                    pointsAdded = secondPlacePoints;
                    break;
                case 2:
                    newPoints = await modifyPoints(x, thirdPlacePoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
                    pointsAdded = thirdPlacePoints;
                    break;
                default:
                    newPoints = await modifyPoints(x, participantPoints, PointsAction.ADD, interaction.user.id, PointType.COMPETITION, interaction.id);
                    pointsAdded = participantPoints;
                    break;
            }
            await modifyNicknamePoints(newPoints ?? 0, member)

            return `${formatDiscordUserTag(x.discordId)} has been given ${pointsAdded} points and now has ${newPoints} points.`;
        }) ?? [];

        const winningText = await Promise.all(winnerResponsesPromises);
        const splitMessageChunks = splitMessage(winningText.join('\n'));
        if (!splitMessageChunks) {
            await interaction.followUp("No points given");
            return;
        }

        const maxChunkSize = 2000;
        const chunkedMessages = splitMessageChunks.reduce((acc: string[], chunk) => {
            const lastChunk = acc[acc.length - 1];
            if (lastChunk && lastChunk.length + chunk.length <= maxChunkSize) {
                acc[acc.length - 1] += '\n' + chunk;
            } else {
                acc.push(chunk);
            }
            return acc;
        }, []);

        await Promise.all(chunkedMessages.map((chunk) => interaction.followUp(chunk)));

        return;
    }
};