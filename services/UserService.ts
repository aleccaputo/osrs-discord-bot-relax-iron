import User, {IUser} from "../models/User";
import dayjs from "dayjs";
import {GuildMember} from "discord.js";
import {PointsAction} from "./DropSubmissionService";
import {UserExistsException} from "../exceptions/UserExistsException";
import {NicknameLengthException} from "../exceptions/NicknameLengthException";

export const createUser = async (member: GuildMember | null) => {
    if (!member) {
        console.error('Unable to add member as user');
        throw new Error('Unable to add member as user');
    }
    const existingMember = await User.findOne({discordId: member.id});
    if (existingMember !== null) {
        console.log(`Member ${member.id} already exists in database`);
        throw new UserExistsException("User found when trying to add new");
    }
    await new User({
        discordId: member.id,
        points: 0,
        joined: dayjs(member.joinedAt?.toUTCString() ?? new Date().toUTCString()).toISOString()
    }).save();
};

export const getUser = async (discordId: string) => {
    return User.findOne({discordId: discordId});
};

export const modifyPoints = async ( user: IUser | null, pointValue: number, action: PointsAction) => {
    if (user) {
        const newPoints = action === PointsAction.ADD ? user.points + pointValue : Math.max(0, user.points - pointValue);
        user.points = newPoints;
        await user.save();
        return user.points;
    }
    return null;
}

export const modifyNicknamePoints = async (newPoints: number, serverMember: GuildMember | null) => {
    if (serverMember) {
        const containsBracketsRe = /.*\[.*\].*/;
        const nickname = serverMember.nickname;
        if (nickname) {
            const newNickname = containsBracketsRe.test(nickname) ? nickname.replace(/\[(.+?)\]/g, `[${newPoints}]`) : `${nickname} [${newPoints}]`;
            if (nickname.length > 32) {
                throw new NicknameLengthException('Nickname is more than 32 characters');
            } else {
                await serverMember.setNickname(newNickname);
            }
        }
    }
}