import User, {IUser} from "../models/User";
import dayjs from "dayjs";
import {GuildMember} from "discord.js";
import {PointsAction} from "./DropSubmissionService";

export const createUser = async (member: GuildMember | null) => {
    if (!member) {
        console.error('Unable to add member as user');
        throw new Error('Unable to add member as user');
    }
    const existingMember = await User.findOne({discordId: member.id});
    if (existingMember !== null) {
        console.log('Member already exists');
        throw new Error('Member already exists as user');
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