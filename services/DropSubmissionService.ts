import {Channel, Emoji, Guild, GuildMember, Message, MessageReaction, TextChannel} from "discord.js";
import User from "../models/User";
import {getUser, modifyNicknamePoints, modifyPoints} from "./UserService";

const NumberEmojis = {
    // ONE: '1️⃣',
    TWO: '2️⃣',
    THREE: '3️⃣',
    // FOUR: '4️⃣',
    FIVE: '5️⃣',
    // SIX: '6️⃣',
    SEVEN: '7️⃣',
    // EIGHT: '8️⃣',
    // NINE: '9️⃣',
    TEN: '🔟'
}
// wonder if the intl lib has something for this
const convertEmojiToNumber = (emoji: Emoji) => {
    switch (emoji.name) {
        case NumberEmojis.TWO:
            return 2;
        case NumberEmojis.THREE:
            return 3;
        case NumberEmojis.FIVE:
            return 5;
        case NumberEmojis.SEVEN:
            return 7;
        case NumberEmojis.TEN:
            return 10;
        default:
            return null;
    }
}

export enum PointsAction {
    ADD = 'add',
    SUBTRACT = 'subtract'
}

export const extractMessageInformationAndProcessPoints = async (reaction: MessageReaction, server?: Guild, privateSubmissionsChannel?: Channel, pointsAction: PointsAction = PointsAction.ADD) => {
    const message = await reaction.message.fetch();
    const userId = message.content.replace('<@', '').slice(0, -1);
    const points = await processPoints(reaction.emoji, userId, pointsAction);
    const serverMember = server?.member(userId);
    if (points) {
        if (serverMember) {
            await modifyNicknamePoints(points, serverMember);
        }
        if (privateSubmissionsChannel && privateSubmissionsChannel.isText()) {
            await privateSubmissionsChannel.send(`<@${userId}> now has ${points} points`);
        }
    }
}

const processPoints = async (emoji: Emoji, userDiscordId: string, action: PointsAction = PointsAction.ADD) => {
    const pointValue = convertEmojiToNumber(emoji);
    if (pointValue) {
        try {
            const user = await getUser(userDiscordId);
            if (!user) {
                return null;
            }
            const newPoints = await modifyPoints(user, pointValue, action)
            return newPoints;
        } catch (e) {
            console.error(e);
        }
    }
    return null;
}

export const reactWithBasePoints = async (message: Message) => {
    // stupid that i can't pass an array.
    // await message.react(NumberEmojis.ONE);
    await message.react(NumberEmojis.TWO);
    await message.react(NumberEmojis.THREE);
    // await message.react(NumberEmojis.FOUR);
    await message.react(NumberEmojis.FIVE);
    // await message.react(NumberEmojis.SIX);
    await message.react(NumberEmojis.SEVEN);
    // await message.react(NumberEmojis.EIGHT);
    // await message.react(NumberEmojis.NINE);
    await message.react(NumberEmojis.TEN);
}