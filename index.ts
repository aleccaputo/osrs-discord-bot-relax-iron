import * as Discord from 'discord.js';
import { ChannelType, Collection, Events, GatewayIntentBits, Partials, User } from 'discord.js';
import * as dotenv from 'dotenv';
import {
    scheduleNicknameIdCsvExtract,
    scheduleReportMembersEligibleForPointsRankUp,
    scheduleReportMembersNotInClan,
    scheduleUserCsvExtract
} from './services/ReportingService';
import { ApplicationQuestions } from './services/constants/application-questions';
import { createApplicationChannel, sendQuestions } from './services/ApplicationService';
import { formatDiscordUserTag, parseServerCommand } from './services/MessageHelpers';
import { connect } from './services/DataService';
import {
    extractMessageInformationAndProcessPoints,
    PointsAction,
    processDinkPost,
    processNonembedDinkPost,
    reactWithBasePoints
} from './services/DropSubmissionService';
import path from 'path';
import fs from 'fs';
import { fetchPointsData } from './services/GoogleApiService';
import { schedule } from 'node-cron';
import { ItemNotFoundException } from './exceptions/ItemNotFoundException';
import { BlacklistRecordExistsException } from './exceptions/BlacklistRecordExistsException';

dotenv.config();

(async () => {
    try {
        const serverId = process.env.SERVER;
        // https://github.com/discordjs/discord.js/issues/4980#issuecomment-723519865
        const client = new Discord.Client({
            intents: [
                GatewayIntentBits.GuildEmojisAndStickers,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.Guilds,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.User, Partials.Reaction, Partials.Message, Partials.Channel]
        });

        client.commands = new Collection();

        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const { command } = require(filePath);
            // Set a new item in the Collection with the key as the command name and the value as the exported module
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }

        let pointsSheet = await fetchPointsData();
        let pointsSheetLookup: Record<string, string> = Object.fromEntries(pointsSheet ?? []);
        console.log(`initial point sheet: \n ${pointsSheet}`);

        // fetch the points sheet once a day at 1am UTC to avoid having to manually restart the server when sheet changes
        const schedulePointsSheetRefresh = () => {
            schedule('0 1 * * *', async () => {
                console.log('fetching new points sheet updates.');
                pointsSheet = await fetchPointsData();
                pointsSheetLookup = Object.fromEntries(pointsSheet ?? []);
                console.log("new point sheet: ");
                console.log(pointsSheet?.toString())
                console.log("new point sheet lookup: ");
                console.log(pointsSheetLookup);
            });
        };

        schedulePointsSheetRefresh();

        // console.log(pointsSheetLookup);

        console.log("logging into client")
        await client.login(process.env.TOKEN);
        console.log("logged into client")
        console.log("connecting to db")
        await connect();
        console.log("db connected")

        client.once('ready', async () => {
            console.log('ready');
            // schedule cronjobs
            const server = client.guilds.cache.find((guild) => guild.id === serverId);
            await server?.members.fetch();
            console.log('found server and members');
            try {
                scheduleUserCsvExtract(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '');
                scheduleReportMembersEligibleForPointsRankUp(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '');
                scheduleReportMembersNotInClan(
                    client,
                    process.env.REPORTING_CHANNEL_ID ?? '',
                    serverId ?? '',
                    process.env.NOT_IN_CLAN_ROLE_ID ?? ''
                );
                scheduleNicknameIdCsvExtract(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '');
                console.log('jobs scheduled');
            } catch (e) {
                console.error(e);
                console.error('failed to initialize reporting tasks');
            }
        });

        client.on('messageCreate', async (message) => {
            // don't respond to messages from self
            if (message.author.id === client.user?.id) {
                return;
            }
            const server = client.guilds.cache.find((guild) => guild.id === serverId);
            if (!server && message.channel.type === ChannelType.GuildText) {
                await message.channel.send("Looks like you're not in the server.");
                return;
            }
            if (!server) {
                return;
            }
            // handle forwarding drop submissions to private channel for manual point assignment
            if (
                (message.channel.id === process.env.PUBLIC_SUBMISSIONS_CHANNEL_ID ||
                    message.channel.id === process.env.HIGH_VALUE_PUBLIC_SUBMISSIONS_CHANNEL_ID) &&
                process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID
            ) {
                const privateSubmissionsChannel = client.channels.cache.get(process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID);
                const messageAttachments = message.attachments.size > 0 ? [...message.attachments.values()] : null;
                if (privateSubmissionsChannel && messageAttachments && privateSubmissionsChannel.type === ChannelType.GuildText) {
                    const privateMessage = await privateSubmissionsChannel.send({
                        content: `<@${message.author.id}>`,
                        files: messageAttachments
                    });
                    await reactWithBasePoints(privateMessage);
                }
            } else if (
                message.channel.id === process.env.DISCORD_WEBHOOK_DROPS_CHANNEL_ID &&
                message.author.id === process.env.DISCORD_WEBHOOK_DROPS_USER_ID
            ) {
                // handle webhook automated points
                // TODO way too much duplication here and in the processing functions
                try {
                    if (message.embeds[0]) {
                        try {
                            await processDinkPost(message, pointsSheetLookup);
                        } catch (e) {
                            if (e instanceof ItemNotFoundException) {
                                const debugChannel = client.channels.cache.get(process.env.RARE_DROP_DEBUG_DUMP_CHANNEL_ID ?? '');
                                if (debugChannel && debugChannel.type === ChannelType.GuildText) {
                                    await debugChannel.send(e.message);
                                }
                            }
                            throw e;
                        }
                    } else {
                        try {
                            await processNonembedDinkPost(message, pointsSheetLookup);
                        } catch (e) {
                            if (e instanceof ItemNotFoundException) {
                                const debugChannel = client.channels.cache.get(process.env.RARE_DROP_DEBUG_DUMP_CHANNEL_ID ?? '');
                                if (debugChannel && debugChannel.type === ChannelType.GuildText) {
                                    await debugChannel.send(e.message);
                                }
                            }
                            throw e;
                        }
                    }
                } catch (e) {
                    if (e instanceof BlacklistRecordExistsException) {
                        const reportingChannel = client.channels.cache.get(process.env.REPORTING_CHANNEL_ID ?? '');
                        if (reportingChannel && reportingChannel.type === ChannelType.GuildText) {
                            await reportingChannel.send(e.message);
                        }
                    }
                }
                // handle clan application in private channel
            } else {
                // TODO, can i make this a slash command
                if (message.channel.type === ChannelType.GuildText && message.channel.topic === 'application') {
                    const usernameForChannel = message.channel.name.split('-').slice(1).join('-').replace('-', ' ');
                    if (usernameForChannel.toLocaleLowerCase() !== message.author.username.replace(/[\W_]/g, '').toLocaleLowerCase()) {
                        return;
                    }
                    const { command } = parseServerCommand(message.content);
                    if (command === 'apply') {
                        await message.channel.send(
                            `Great! I will now send you a series of ${ApplicationQuestions.length} questions. Please respond to each one in a single message. This will be your application. The messages will be sent in this channel and you will respond to each one here by sending a message back.`
                        );
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
            // handle emoji reactions for manual point processing
            if (reaction.message.channel.id === process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID) {
                const server = client.guilds.cache.find((guild) => guild.id === serverId);
                await extractMessageInformationAndProcessPoints(
                    reaction,
                    server,
                    client.channels.cache.get(process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID),
                    PointsAction.ADD,
                    client.user?.id,
                    user
                );
                console.log('am am about to process');
            }
            // handle creating the private application message when new users click the check in the welcome channel
            if (reaction.message.channel.id === process.env.INTRO_CHANNEL_ID) {
                const emoji = '✅';
                if (reaction.emoji.name === emoji) {
                    const server = client.guilds.cache.find((guild) => guild.id === serverId);
                    if (server) {
                        const guildMember = server.members.cache.get(user.id);
                        if (guildMember) {
                            const fetchedMember = await guildMember.fetch();
                            // cant create an application channel if you already have a role
                            if ([...fetchedMember?.roles.cache.values()].filter((x) => x.name !== '@everyone').length) {
                                await reaction.users.remove(user as User);
                                return;
                            }
                            await createApplicationChannel(server, user, client.user?.id);
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
            // if a reaction is removed for manual points, make sure to subtract those points from the user
            if (reaction.message.channel.id === process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID) {
                const server = client.guilds.cache.find((guild) => guild.id === serverId);
                await extractMessageInformationAndProcessPoints(
                    reaction,
                    server,
                    client.channels.cache.get(process.env.PRIVATE_SUBMISSIONS_CHANNEL_ID),
                    PointsAction.SUBTRACT
                );
            }
        });

        client.on('guildMemberRemove', async (member) => {
            if (process.env.REPORTING_CHANNEL_ID) {
                // inform moderators when a member leaves the server and when their nickname in the server was
                const discordUser = await client.users.fetch(member.id);
                const reportingChannel = client.channels.cache.get(process.env.REPORTING_CHANNEL_ID);
                if (reportingChannel && reportingChannel.type === ChannelType.GuildText) {
                    try {
                        let message = `${discordUser.username} has left the server.`;
                        if (member.nickname) {
                            message += ` OSRS name was ${member.nickname}.\nCheck the in game clan to see if they are still there.`;
                        }
                        await reportingChannel.send(message);
                    } catch (e) {
                        // still attempt to PM the user if we weren't able to send the message to the channel
                        console.log('unable to send server leave message');
                    }
                }
            }
        });

        // handle all slash commands (logic in ./commands/
        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        });
    } catch (e) {
        console.log(e);
        console.log('error on startup!');
    }
})();
