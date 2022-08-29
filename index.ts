import * as Discord from 'discord.js';
import * as dotenv from 'dotenv';
import {scheduleUserCsvExtract,
    scheduleReportMembersEligibleForPointsRankUp,
    scheduleReportMembersNotInClan,
} from "./services/ReportingService";
import {ApplicationQuestions} from "./services/constants/application-questions";
import {createApplicationChannel, sendQuestions} from "./services/ApplicationService";
import {formatDiscordUserTag, parseServerCommand, stripDiscordCharactersFromId} from "./services/MessageHelpers";
import {connect} from "./services/DataService";
import {
    extractMessageInformationAndProcessPoints,
    PointsAction,
    reactWithBasePoints
} from "./services/DropSubmissionService";
import {createUser, getUser, modifyNicknamePoints, modifyPoints} from "./services/UserService";
import {Intents, User} from "discord.js";
import {UserExistsException} from "./exceptions/UserExistsException";
import {NicknameLengthException} from "./exceptions/NicknameLengthException";
import {createPointsLeaderboard} from "./services/RankService";

dotenv.config();
let lastRequestForPointsTime: number | null = null;
const rateLimitSeconds = 2;

;(async () => {
    try {
        const serverId = process.env.SERVER;
        // https://github.com/discordjs/discord.js/issues/4980#issuecomment-723519865
        const client = new Discord.Client({intents: [
                Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
                Intents.FLAGS.GUILD_INVITES,
                Intents.FLAGS.GUILD_MEMBERS,
                Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.GUILDS
            ],
            partials: ['USER', 'REACTION', 'MESSAGE']
        });
        await client.login(process.env.TOKEN);
        await connect();

        client.once('ready', async () => {
            const guild = client.guilds.cache.find(guild => guild.id === serverId);
            if (guild) {
                await guild.members.fetch();
            }
            console.log('ready');
            try {
                scheduleUserCsvExtract(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '');
                scheduleReportMembersEligibleForPointsRankUp(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '');
                scheduleReportMembersNotInClan(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '', process.env.NOT_IN_CLAN_ROLE_ID ?? '')
            } catch (e) {
                console.error(e);
                console.error("failed to initialize reporting tasks");
            }
        });

        client.on('messageCreate', async (message) => {
            // don't respond to messages from self
            if (message.author.id === client.user?.id) {
                return;
            }
            const server = client.guilds.cache.find(guild => guild.id === serverId);
            if (!server) {
                await message.channel.send("Looks like you're not in the server.")
                return;
            }
            const mods = server.members.cache.filter(member => member.roles.cache.some(r => r.id === process.env.MOD_ROLE_ID));
            // Accept application for user. must be from a mod and in this channel
            if (message.channel.id === process.env.AWAITING_APPROVAL_CHANNEL_ID) {
                const {command, context} = parseServerCommand(message.content);
                if (command === 'confirm' && context) {
                    // this is returned in the format <!@12345>, so we need to get rid of all the special chars
                    const userId = (context.replace(/[^0-9]/g, ''));
                    const user = client.users.cache.get(userId);
                    if (user) {
                        const guildMember = server.members.cache.get(user.id);
                        if (process.env.NOT_IN_CLAN_ROLE_ID && process.env.RANK_ONE_ID && process.env.VERIFIED_ROLE_ID) {
                            await guildMember?.roles.add([process.env.RANK_ONE_ID, process.env.VERIFIED_ROLE_ID]);
                            await guildMember?.roles.remove(process.env.NOT_IN_CLAN_ROLE_ID);
                            // delete the application channel
                            const usernameWithoutSpaces = user.username.replace(' ', '-').toLocaleLowerCase();
                            const applicationChannel = server.channels.cache.find(x => x.name === `application-${usernameWithoutSpaces}`);
                            if (applicationChannel) {
                                await applicationChannel.delete()
                            }
                            try {
                                await createUser(guildMember);
                            } catch (e) {
                                if (process.env.REPORTING_CHANNEL_ID) {
                                    const reportingChannel = client.channels.cache.get(process.env.REPORTING_CHANNEL_ID);
                                    if (reportingChannel && reportingChannel.isText()) {
                                        if (e instanceof UserExistsException) {
                                            await reportingChannel.send(`<@${userId}> is already a user in the system (potential server re-join). Please ensure their discord profile is set correctly.`);
                                        } else {
                                            await reportingChannel.send(`Unable to add <@${userId}> as a user. Please contact a developer`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (message.channel.id === process.env.PUBLIC_SUBMISSIONS_CHANNEL_ID && process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID) {
                const privateSubmissionsChannel = client.channels.cache.get(process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID);
                const messageAttachments = message.attachments.size > 0 ? [...message.attachments.values()] : null;
                if (privateSubmissionsChannel && messageAttachments && privateSubmissionsChannel.isText()) {
                    const privateMessage = await privateSubmissionsChannel.send({content: `<@${message.author.id}>`, files: messageAttachments});
                    await reactWithBasePoints(privateMessage);
                }
                else {
                    const publicSubmissionsChannel = client.channels.cache.get(process.env.PUBLIC_SUBMISSIONS_CHANNEL_ID ?? '');
                    const {command} = parseServerCommand(message.content);
                    if (command === 'mypoints') {
                        // rate limit any requests that are checking non-discord apis (ie internal storage)
                        if (lastRequestForPointsTime && message.createdTimestamp - (rateLimitSeconds * 1000) < lastRequestForPointsTime) {
                            return;
                        }
                        const userId = message.author.id;
                        try {
                            const dbUser = await getUser(userId);
                            if (publicSubmissionsChannel && publicSubmissionsChannel.isText() && dbUser) {
                                await publicSubmissionsChannel.send(`<@${userId}> has ${dbUser.points} points`)
                            } else {
                                return;
                            }

                        } catch (e) {
                            console.error("unable to fetch a users points", e);
                            return;
                        }
                    }
                    if (command === 'leaderboard') {
                        // rate limit any requests that are checking non-discord apis (ie internal storage)
                        if (lastRequestForPointsTime && message.createdTimestamp - (rateLimitSeconds * 1000) < lastRequestForPointsTime) {
                            return;
                        }
                        if (publicSubmissionsChannel && publicSubmissionsChannel.isText()) {
                            try {
                                const embed = await createPointsLeaderboard(server);
                                await publicSubmissionsChannel.send({embeds: [embed]});
                            } catch (e) {
                                console.error("unable to create leaderboard", e);
                                return;
                            }
                        } else {
                            return;
                        }
                    }
                }
            } else if (message.channel.id === process.env.REPORTING_CHANNEL_ID) {
                const reportingChannel = client.channels.cache.get(process.env.REPORTING_CHANNEL_ID);
                const {command, context, context2} = parseServerCommand(message.content);
                // format: !serverCommand modifyPoints @username +/-points
                if (command === 'modifypoints') {
                    // rate limit any requests that are checking non-discord apis (ie internal storage)
                    if (lastRequestForPointsTime && message.createdTimestamp - (rateLimitSeconds * 1000) < lastRequestForPointsTime) {
                        return;
                    }
                    lastRequestForPointsTime = message.createdTimestamp;
                    // do we have a value?
                    if (context2 && reportingChannel && reportingChannel.isText()) {
                        const operator = context2.charAt(0);
                        const userId = stripDiscordCharactersFromId(context ?? '');
                        const pointNumber = parseInt(context2.substring(1), 10);
                        if (operator !== '+' && operator !== '-' || !userId) {
                            await reportingChannel.send('Invalid command. Please user the form `!relax modifyPoints @discordNickname +10` or to subtract `-10`');
                            return;
                        }
                        const user = await getUser(userId);
                        if (user) {
                            const newPoints = await modifyPoints(user, pointNumber, operator === '+' ? PointsAction.ADD : PointsAction.SUBTRACT);
                            if (newPoints) {
                                await reportingChannel.send(`${formatDiscordUserTag(userId)} now has ${newPoints} points`);
                                const serverMember = server.members.cache.get(user.id);
                                try {
                                    await modifyNicknamePoints(newPoints, serverMember)
                                } catch (e) {
                                    if (e instanceof NicknameLengthException) {
                                        await reportingChannel.send('Nickname is either too long or will be too long. Must be less than or equal to 32 characters.')
                                        return;
                                    } else {
                                        await reportingChannel.send(`Unable to set points or modify nickname for <@${userId}>`);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                if (message.channel.type === 'GUILD_TEXT' && message.channel.topic === 'application') {
                    const usernameForChannel = message.channel.name.split('-').slice(1).join('-').replace('-', ' ');
                    if (usernameForChannel.toLocaleLowerCase() !== message.author.username.toLocaleLowerCase()) {
                        return;
                    }
                    const {command} = parseServerCommand(message.content);
                    if (command === 'apply') {
                        await message.channel.send(`Great! I will now send you a series of ${ApplicationQuestions.length} questions. Please respond to each one in a single message. This will be your application. The messages will be sent in this channel and you will respond to each one here by sending a message back.`)
                        if (process.env.AWAITING_APPROVAL_CHANNEL_ID) {
                            await sendQuestions(message, server, client.channels.cache.get(process.env.AWAITING_APPROVAL_CHANNEL_ID));
                        }
                    }
                }
            }
        });

        client.on('messageReactionAdd', async (reaction, user) => {
            // don't respond to messages from self (the bot)
            if (user.id === client.user?.id) {
                return;
            }
            if (reaction.message.channel.id === process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID) {
                const server = client.guilds.cache.find(guild => guild.id === serverId);
                await extractMessageInformationAndProcessPoints(reaction, server, client.channels.cache.get(process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID), PointsAction.ADD, client.user?.id, user)
            }
            if (reaction.message.channel.id === process.env.INTRO_CHANNEL_ID) {
                const emoji = '✅';
                if (reaction.emoji.name === emoji) {
                    const server = client.guilds.cache.find(guild => guild.id === serverId);
                    if (server) {
                        const guildMember = server.members.cache.get(user.id);
                        if (guildMember) {
                            const fetchedMember = await guildMember.fetch();
                            // cant create an application channel if you already have a role
                            if ([...fetchedMember?.roles.cache.values()].filter(x => x.name !== '@everyone').length) {
                                await reaction.users.remove(user as User);
                                return;
                            }
                            await createApplicationChannel(server, user, client.user?.id)
                        }
                    }
                    await reaction.users.remove(user as User);
                }
            }
        });

        client.on('messageReactionRemove', async (reaction, user) => {
            // don't respond to messages from self (the bot)
            if (user.id === client.user?.id) {
                return;
            }
            if (reaction.message.channel.id === process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID) {
                const server = client.guilds.cache.find(guild => guild.id === serverId);
                await extractMessageInformationAndProcessPoints(reaction, server, client.channels.cache.get(process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID), PointsAction.SUBTRACT)
            }
        });

        client.on('guildMemberRemove', async (member) => {
            if (process.env.REPORTING_CHANNEL_ID) {
                const discordUser = await client.users.fetch(member.id);
                const reportingChannel = client.channels.cache.get(process.env.REPORTING_CHANNEL_ID);
                if (reportingChannel && reportingChannel.isText()) {
                    try {
                        let message = `${discordUser.username} has left the server.`;
                        if (member.nickname) {
                            message += ` OSRS name was ${member.nickname}.\nCheck the in game clan to see if they are still there.`
                        }
                        await reportingChannel.send(message);
                    } catch (e) {
                        // still attempt to PM the user if we weren't able to send the message to the channel
                        console.log("unable to send server leave message")
                    }
                }
            }
        });
    } catch (e) {
        console.log(e);
        console.log('error on startup!')
    }
})();

