import {
    Channel,
    ChannelType,
    Guild,
    Message,
    MessageCollector,
    OverwriteType,
    PartialUser,
    Permissions,
    PermissionsBitField,
    TextChannel,
    User
} from 'discord.js';
import { ApplicationQuestions, IApplicationQuestionAnswer } from './constants/application-questions';
import * as dotenv from 'dotenv';

dotenv.config();

const formatApplication = (answers: Array<string>, authorId: string) => {
    const questionAnswers: Array<IApplicationQuestionAnswer> = ApplicationQuestions.map((applicationQuestion, index) => ({
        ...applicationQuestion,
        answer: answers[index]
    }));
    // this gross string of characters in the beginning seems to be the only way to do a <hr>, markdown isn't working
    let applicationString = `__\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\___ \n\n__**New Application for <@${authorId}>**__\n`;
    questionAnswers.forEach((qa) => {
        applicationString += `**${qa.question}**\n${qa.answer}\n`;
    });

    return applicationString;
};

export const sendQuestions = async (message: Message, server: Guild, approvalChannel?: Channel) => {
    let questionCounter = 0;
    // assert the person sending the response is the same we sent the application to.
    const questionFilter = (m: Message) => m.author.id === message.author.id;
    const collector = new MessageCollector(message.channel as TextChannel, {
        filter: questionFilter,
        max: ApplicationQuestions.length
    });
    if (message.channel.type === ChannelType.GuildText) {
        message.channel.send(ApplicationQuestions[questionCounter++].question);
        collector.on('collect', (m) => {
            if (questionCounter < ApplicationQuestions.length) {
                if (message.channel.type === ChannelType.GuildText) {
                    message.channel.send(ApplicationQuestions[questionCounter++].question);
                }
            }
        });
        collector.on('end', async (collected) => {
            if (message.channel.type === ChannelType.GuildText) {
                await message.channel.send(
                    `Thank you for filling out the application, our bot will send us your application. Once your application has been reviewed and you will then be requested to meet in-game for a clan invite before your application is accepted. If you don’t work with a mod to get a in-game clan invite within the next 48 hours you will be kicked from the Discord Server and have to re apply again.`
                );
            }
            if (process.env.NOT_IN_CLAN_ROLE_ID) {
                const guildMember = server.members.cache.get(message.author.id);
                await guildMember?.roles.add(process.env.NOT_IN_CLAN_ROLE_ID);
            }
            const collectedArray = [...collected.values()].map((x) => x.toString());
            const username = collectedArray[0];
            try {
                await server.members.cache.get(message.author.id)?.setNickname(username);
            } catch (e) {
                console.log(e);
            }
            if (approvalChannel && approvalChannel.type === ChannelType.GuildText) {
                const formattedApplication = formatApplication(
                    [...collected.values()].map((x) => x.toString()),
                    message.author.id
                );
                await approvalChannel.send(formattedApplication);
            }
        });
    }
};

export const createApplicationChannel = async (server: Guild, applicant: User | PartialUser, botId?: string) => {
    const strippedUsername = applicant?.username?.replace(/[\W_]/g, '');
    const channelName = `application-${strippedUsername}`;
    const applicationChannel = server.channels.cache.find((x) => x.name === channelName);
    if (applicationChannel) {
        console.log('application channel already exists');
        return;
    }
    const channel = await server.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        topic: 'application',
        parent: process.env.APPLICATIONS_CHANNEL_CATEGORY_ID,
        permissionOverwrites: [
            {
                id: process.env.MOD_ROLE_ID ?? '',
                type: OverwriteType.Role,
                allow: PermissionsBitField.Default
            },
            {
                id: process.env.ADMIN_ROLE_ID ?? '',
                type: OverwriteType.Role,
                allow: PermissionsBitField.Default
            },
            {
                id: process.env.OWNER_ROLE_ID ?? '',
                type: OverwriteType.Role,
                allow: PermissionsBitField.Default
            },
            {
                id: applicant.id,
                type: OverwriteType.Member,
                allow: [
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ViewChannel
                ]
            },
            {
                id: botId ?? '',
                type: OverwriteType.Member,
                allow: PermissionsBitField.Default
            },
            {
                id: server.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            }
        ]
    });
    await channel.send(`Welcome <@${applicant.id}>! To start your application type !relax apply`);
};
