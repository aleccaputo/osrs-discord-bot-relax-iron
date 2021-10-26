import * as Discord from 'discord.js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import {
    initializeClanDiscordSync,
    scheduleReportMembersEligibleForRankUp,
    scheduleReportMembersNotInClan
} from "./services/ReportingService";
import {Rules} from "./services/constants/rules";
import {ApplicationQuestions} from "./services/constants/application-questions";
import {sendQuestions} from "./services/ApplicationService";
import {parseServerCommand} from "./services/MessageHelpers";
import {addMemberToGroup} from "./services/WiseOldManService";
dotenv.config();

const serverId = process.env.SERVER;
const client = new Discord.Client();


client.login(process.env.TOKEN);

client.once('ready', async () => {
    console.log('ready');
    try {
        initializeClanDiscordSync(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '', process.env.WISE_OLD_MAN_GROUP_ID ?? '');
        scheduleReportMembersEligibleForRankUp(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '', process.env.WISE_OLD_MAN_GROUP_ID ?? '');
        scheduleReportMembersNotInClan(client, process.env.REPORTING_CHANNEL_ID ?? '', serverId ?? '', process.env.NOT_IN_CLAN_ROLE_ID ?? '')
    } catch (e) {
        console.error(e);
        console.error("failed to initialize reporting tasks");
    }
});

client.on('message', async (message) => {
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

    if (message.channel.type === "dm") {
        // they've agreed to the rules, send out the application questions
        const {command} = parseServerCommand(message.content);
        if (command === 'agree') {
            await message.channel.send(`Great! I will now send you a series of ${ApplicationQuestions.length} questions. Please respond to each one in a single message. This will be your application.
            The messages will be sent in this DM and you will respond to each one here by sending a message back.`)
            if(process.env.AWAITING_APPROVAL_CHANNEL_ID) {
                sendQuestions(message, server, client.channels.cache.get(process.env.AWAITING_APPROVAL_CHANNEL_ID));
            }
        }
    } else {
        // Accept application for user. must be from a mod and in this channel
        if (message.channel.id === process.env.AWAITING_APPROVAL_CHANNEL_ID) {
            const {command, context} = parseServerCommand(message.content);
            if (command === 'confirm' && context) {
                // this is returned in the format <!@12345>, so we need to get rid of all the special chars
                const user = client.users.cache.get(context.replace(/[^0-9]/g, ''));
                if (user) {
                    const guildMember = server.member(user);
                    if (process.env.NOT_IN_CLAN_ROLE_ID && process.env.RANK_ONE_ID &&  process.env.VERIFIED_ROLE_ID) {
                        await guildMember?.roles.add([process.env.RANK_ONE_ID, process.env.VERIFIED_ROLE_ID]);
                        await guildMember?.roles.remove(process.env.NOT_IN_CLAN_ROLE_ID);
                        const ign = guildMember?.nickname;
                        if (ign) {
                            if (!process.env.WISE_OLD_MAN_GROUP_ID || !process.env.WISE_OLD_MAN_VERIFICATION_CODE) {
                                return;
                            }
                            const response = await addMemberToGroup(process.env.WISE_OLD_MAN_GROUP_ID, ign, process.env.WISE_OLD_MAN_VERIFICATION_CODE);
                            if (!response) {
                                mods.forEach(mod => mod.send(`Unable to add <@${message.author.id}> to wise old man.`));
                            }
                        }
                    }
                }
            }
        }
    }
});

client.on('guildMemberAdd', async (member) => {
    await member.send('', {
        files: [
            './assets/chilltopia-banner.png',
            './assets/rules.png'
        ]
    });
    await member.send(Rules);
});

client.on('guildMemberRemove', async (member) => {
    if (process.env.REPORTING_CHANNEL_ID) {
        const reportingChannel = client.channels.cache.get(process.env.REPORTING_CHANNEL_ID);
        if (reportingChannel && reportingChannel.isText()) {
            try {
                let message = `<@${member.id}> has left the server.`;
                if (member.nickname) {
                    message += ` OSRS name is ${member.nickname}.\nCheck the in game clan to see if they are still there. If not, consider removing them from wise old man.`
                }
                await reportingChannel.send(message);
            } catch (e) {
                // still attempt to PM the user if we weren't able to send the message to the channel
                console.log("unable to send server leave message")
            }
        }
    }
});
