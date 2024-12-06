import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from 'discord.js';
import {
    getRecentEndedCompetitionSortedAndGained,
    getCompParticipantsSorted,
    createWinnersResponseMessage
} from '../services/CompetitionService';
import { splitMessage } from '../services/MessageHelpers';
import { isModRank } from '../utilities';

export interface IRewardCompWinnersParameters {
    firstPlacePoints: number;
    secondPlacePoints: number;
    thirdPlacePoints: number;
    participantPoints: number;
    threshold: number;
    id: number | null;
}

export const command = {
    data: new SlashCommandBuilder()
        .setName('rewardcompwinners')
        .setDescription('Reward the winners of a competition')
        .addIntegerOption((o) => o.setName('id').setDescription('the id of the competition in WOM').setRequired(true))
        .addIntegerOption((o) => o.setName('firstpoints').setDescription('points to give to first place').setRequired(true))
        .addIntegerOption((o) => o.setName('secondpoints').setDescription('points to give to second place').setRequired(true))
        .addIntegerOption((o) => o.setName('thirdpoints').setDescription('points to give to third place').setRequired(true))
        .addIntegerOption((o) => o.setName('participantpoints').setDescription('points to give to everyone else that participated').setRequired(true))
        .addIntegerOption((o) => o.setName('threshold').setDescription('value threshold for XP or KC. Make sure you know the competition. Defaults to > 0.').setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction) {
        const compId = interaction.options.getInteger('id');
        const firstPlacePoints = interaction.options.getInteger('firstpoints') ?? 0;
        const secondPlacePoints = interaction.options.getInteger('secondpoints') ?? 0;
        const thirdPlacePoints = interaction.options.getInteger('thirdpoints') ?? 0;
        const threshold = interaction.options.getInteger('threshold') ?? 0;
        const participantPoints = interaction.options.getInteger('participantpoints') ?? 0;

        const parameters: IRewardCompWinnersParameters = {
            firstPlacePoints,
            secondPlacePoints,
            thirdPlacePoints,
            participantPoints,
            threshold,
            id: compId
        }

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

        if (!parameters.firstPlacePoints || !parameters.secondPlacePoints || !parameters.thirdPlacePoints || !parameters.participantPoints) {
            await interaction.editReply({ content: 'Error: 1st, 2nd, 3rd, and participant points must be specified' });
        }

/*        const comp = compId
            ? await getCompParticipantsSorted(interaction.guild, parameters.id!, parameters.threshold)
            : await getRecentEndedCompetitionSortedAndGained(interaction.guild, parameters.threshold);*/

        const comp = await getCompParticipantsSorted(interaction.guild, parameters.id!, parameters.threshold);

        await interaction.editReply(`Please wait while I calculate points for ${comp?.competition.title} (Id: ${comp?.competition.id}) in the background...`);

        const winnerResponsesPromises = createWinnersResponseMessage(comp, parameters, interaction);

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