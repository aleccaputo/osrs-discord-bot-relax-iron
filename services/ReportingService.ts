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
    let message = 'We have some users ready to rank up!';
    members.forEach((member) => {
        if (member) {
            message += `\n<@${member.userId}> -> ${member.nextRank.name}`;
        }
    });
    console.log(message);
    return message;
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

const initializeReportMembersEligibleForTimeBasedRankUp = async (client: Client, reportingChannelId: string, serverId: string) => {
    console.log('Kicking off member rankup cron...');
    const server = client.guilds.cache.find((guild) => guild.id === serverId);
    if (server) {
        const today = dayjs();
        // dont get from cache, we need an up to date list
        const currentMembers = await server.members.fetch();
        const membersDueForRank = currentMembers
            .filter((x) => x.joinedAt !== null)
            .map((member) => {
                // hard casting date since its not picking up on the filter
                const joinedDate = dayjs(member.joinedAt as Date);
                const monthsInServer = today.diff(joinedDate, 'month');
                const memberRoleIds = member.roles.cache.map((role) => role.id);
                const currentRanks = TimeRoles.filter((x) => memberRoleIds.includes(x.id));
                if (currentRanks && currentRanks.length) {
                    const highestRank = currentRanks.reduce((prev, current) => (prev.order > current.order ? prev : current));
                    if (monthsInServer >= highestRank.maxMonths) {
                        const nextRank = TimeRoles.find((x) => x.order === highestRank.order + 1);
                        // we can rank this user up!
                        if (nextRank) {
                            return {
                                userId: member.id,
                                nextRank: nextRank
                            } as IMemberDueForRank<TimeRole>;
                        }
                    }
                }
            })
            .filter((x) => x !== undefined);
        console.log(membersDueForRank);
        if (membersDueForRank && membersDueForRank.length) {
            const reportingChannel = client.channels.cache.get(reportingChannelId);
            if (reportingChannel && reportingChannel.type === ChannelType.GuildText) {
                const message = formatRankUpMessage(membersDueForRank);
                try {
                    await reportingChannel.send(message);
                } catch (e) {
                    console.log('Error sending rank up report to channel');
                    console.log(e);
                }
            }
        }
    }
};

export const initializeReportMembersEligibleForPointsBasedRankUp = async (client: Client, reportingChannelId: string, serverId: string) => {
    if (mongoose.connection.readyState === 0) {
        await connect();
    }
    const server = client.guilds.cache.find((guild) => guild.id === serverId);
    if (server) {
        const currentMembers = await server.members.fetch();
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
                const message = formatRankUpMessage(rankUps);
                try {
                    await reportingChannel.send(message);
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
        const currentMembers = await server.members.fetch();
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
            const currentMembers = await server.members.fetch();
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

    const writeStream = fs.createWriteStream(`./${filename}`, { flags: 'w+' });
    try {
        const allInternalUsers = await User.find({});
        const stream = fastcsv.format({ headers: true });
        stream.pipe(writeStream);
        allInternalUsers.map((user) => stream.write(user.toJSON()));

        writeStream.on('close', async () => {
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
        });
        writeStream.end();
    } catch (e) {
        console.error('Error creating csv backup for' + filename);
        writeStream.end();
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
