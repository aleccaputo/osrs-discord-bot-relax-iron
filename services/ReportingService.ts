import { schedule } from 'node-cron';
import type { Client } from 'discord.js';
import dayjs from 'dayjs';
import { PointsRole, PointsRoles, TimeRole, TimeRoles } from './constants/roles';
import { ChannelType, GuildMember } from 'discord.js';
import mongoose from 'mongoose';
import { connect } from './DataService';
import User from '../models/User';
import * as fastcsv from 'fast-csv';
import * as fs from 'fs';

interface IMemberDueForRank<T> {
    userId: string;
    nextRank: T;
}

const formatRankUpMessage = (members: Array<IMemberDueForRank<TimeRole | PointsRole> | undefined>) => {
    const messages: string[] = [];
    let currentMessage = 'We have some users ready to rank up!';
    
    members.forEach((member) => {
        if (member) {
            const line = `\n<@${member.userId}> -> ${member.nextRank.name}`;
            
            if ((currentMessage + line).length > 2000) {
                messages.push(currentMessage);
                currentMessage = line.trimStart();
            } else {
                currentMessage += line;
            }
        }
    });
    
    if (currentMessage.length > 0) {
        messages.push(currentMessage);
    }
    
    console.log(`Split rank up message into ${messages.length} message(s)`);
    return messages;
};

const formatNotInClanMessage = (members: Array<GuildMember>) => {
    let message = 'The following members have the "Not In Clan" Role:';
    members.forEach((member) => {
        if (member) {
            message += `\n<@${member.id}>`;
        }
    });
    message += '\nOnce they are in the clan, please remove this role';
    console.log(message);
    return message;
};

export const initializeReportMembersEligibleForPointsBasedRankUp = async (client: Client, reportingChannelId: string, serverId: string) => {
    if (mongoose.connection.readyState === 0) {
        await connect();
    }
    const server = client.guilds.cache.find((guild) => guild.id === serverId);
    if (server) {
        const currentMembers = server.members.cache;
        const allInternalUsers = await User.find({});
        // filter only verified and they must already have a rank
        const rankUps = [...currentMembers.values()]
            .filter((allMember) => [...allMember.roles.cache.values()].filter((x) => x.id === process.env.VERIFIED_ROLE_ID).length)
            .filter((x) => x.roles.cache.some((y) => PointsRoles.filter((z) => z.id === y.id).length > 0))
            .map((member) => {
                const existing = allInternalUsers.find((x) => x.discordId === member.id);
                if (existing) {
                    const currentPoints = existing.points;
                    const roleBasedOnPoints = PointsRoles.find((x) => currentPoints >= x.minPoints && currentPoints < x.maxPoints);
                    const memberRoleIds = member.roles.cache.map((role) => role.id);
                    // they are the rank they should be
                    if (memberRoleIds.find((x) => x === roleBasedOnPoints?.id)) {
                        return;
                    }
                    return {
                        userId: member.id,
                        nextRank: roleBasedOnPoints
                    } as IMemberDueForRank<PointsRole>;
                }
            })
            .filter((x) => x !== undefined && x.userId !== client.user?.id);

        if (rankUps && rankUps.length) {
            const reportingChannel = client.channels.cache.get(reportingChannelId);
            if (reportingChannel && reportingChannel.type === ChannelType.GuildText) {
                const messages = formatRankUpMessage(rankUps);
                try {
                    for (const message of messages) {
                        await reportingChannel.send(message);
                    }
                } catch (e) {
                    console.log('Error sending rank up report to channel');
                    console.log(e);
                }
            }
        }
    }
};

const initializeReportMembersNotInClan = async (client: Client, reportingChannelId: string, serverId: string, notInClanId: string) => {
    console.log('Kicking off member not in clan cron...');
    const server = client.guilds.cache.find((guild) => guild.id === serverId);
    if (server) {
        const currentMembers = server.members.cache;
        const membersWithNotInClanRole = [...currentMembers.filter((x) => x.roles.cache.some((y) => y.id === notInClanId)).values()];
        if (membersWithNotInClanRole.length) {
            const reportingChannel = client.channels.cache.get(reportingChannelId);
            if (reportingChannel && reportingChannel.type === ChannelType.GuildText) {
                const message = formatNotInClanMessage(membersWithNotInClanRole);
                try {
                    await reportingChannel.send(message);
                } catch (e) {
                    console.log('Error sending not in clan report to channel');
                    console.log(e);
                }
            }
        }
    }
};

export const initializeDiscordIdToNicknameCsvExtract = async (client: Client, reportingChannelId: string, serverId: string) => {
    if (mongoose.connection.readyState === 0) {
        await connect();
    }
    const server = client.guilds.cache.find((guild) => guild.id === serverId);
    const year = dayjs().year();
    const month = dayjs().month();
    const day = dayjs().date();
    const filename = `${year}_${month + 1}_${day}_discordId_nickname_extract.csv`;
    console.log('generating' + filename);

    const writeStream = fs.createWriteStream(`./${filename}`, { flags: 'w+' });
    try {
        if (server) {
            const currentMembers = server.members.cache;
            const stream = fastcsv.format({ headers: true });
            stream.pipe(writeStream);
            currentMembers.map((member) =>
                stream.write({ nickname: member.nickname ?? member.user.username ?? '', id: member.id.toString() })
            );

            writeStream.on('close', async () => {
                if (server) {
                    const reportingChannel = client.channels.cache.get(reportingChannelId);
                    if (reportingChannel && reportingChannel.type === ChannelType.GuildText) {
                        try {
                            await reportingChannel.send({
                                content: 'Nickname/discordId csv generated.',
                                files: [
                                    {
                                        attachment: `./${filename}`,
                                        name: filename
                                    }
                                ]
                            });
                        } catch (e) {
                            console.log(e);
                        }
                    }
                }
            });
            writeStream.end();
        }
    } catch (e) {
        console.error('Error creating nicname/id csv for' + filename);
        writeStream.end();
    }
};

export const initializeUserCsvExtract = async (client: Client, reportingChannelId: string, serverId: string) => {
    if (mongoose.connection.readyState === 0) {
        await connect();
    }
    const server = client.guilds.cache.find((guild) => guild.id === serverId);
    const year = dayjs().year();
    const month = dayjs().month();
    const day = dayjs().date();
    const filename = `${year}_${month + 1}_${day}_users_extract.csv`;
    console.log('generating' + filename);

    try {
        const allInternalUsers = await User.find({});
        const csvData = allInternalUsers.map(user => user.toJSON());
        // Write all data at once instead of streaming individual records
        await new Promise((resolve, reject) => {
            const stream = fastcsv.write(csvData, { headers: true });
            const writeStream = fs.createWriteStream(`./${filename}`);

            stream.pipe(writeStream);

            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        if (server) {
            const reportingChannel = client.channels.cache.get(reportingChannelId);
            if (reportingChannel && reportingChannel.type === ChannelType.GuildText) {
                try {
                    await reportingChannel.send({
                        content: 'Users backup csv generated.',
                        files: [
                            {
                                attachment: `./${filename}`,
                                name: filename
                            }
                        ]
                    });
                } catch (e) {
                    console.log(e);
                }
            }
        }
    } catch (e) {
        console.error('Error creating csv backup for' + filename);
    }
};

export const scheduleReportMembersEligibleForPointsRankUp = (client: Client, reportingChannelId: string, serverId: string) => {
    schedule('0 20 * * *', async () => {
        try {
            await initializeReportMembersEligibleForPointsBasedRankUp(client, reportingChannelId, serverId);
        } catch (e) {
            console.log(e);
        }
    });
};

export const scheduleReportMembersNotInClan = (client: Client, reportingChannelId: string, serverId: string, notInClanId: string) => {
    schedule('5 21 * * *', async () => {
        try {
            await initializeReportMembersNotInClan(client, reportingChannelId, serverId, notInClanId);
        } catch (e) {
            console.log(e);
        }
    });
};

export const scheduleUserCsvExtract = (client: Client, reportingChannelId: string, serverId: string) => {
    schedule('0 19 * * *', async () => {
        try {
            await initializeUserCsvExtract(client, reportingChannelId, serverId);
        } catch (e) {
            console.log(e);
        }
    });
};

export const scheduleNicknameIdCsvExtract = (client: Client, reportingChannelId: string, serverId: string) => {
    schedule('0 15 * * 5', async () => {
        try {
            await initializeDiscordIdToNicknameCsvExtract(client, reportingChannelId, serverId);
        } catch (e) {
            console.log(e);
        }
    });
};
