import { Channel, ChannelType, Emoji, Guild, Message, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import { getUser, modifyNicknamePoints, modifyPoints } from './UserService';
import { NicknameLengthException } from '../exceptions/NicknameLengthException';
import { auditPoints } from './AuditService';
import { PointType } from '../models/PointAudit';

const NumberEmojis = {
    ONE: '1️⃣',
    TWO: '2️⃣',
    THREE: '3️⃣',
    FOUR: '4️⃣',
    FIVE: '5️⃣',
    SIX: '6️⃣',
    SEVEN: '7️⃣',
    EIGHT: '8️⃣',
    NINE: '9️⃣',
    TEN: '🔟'
};

const whiteCheckEmoji = '✅';

export const convertNumberToEmoji = (num: number) => {
    switch (num) {
        case 1:
            return NumberEmojis.ONE;
        case 2:
            return NumberEmojis.TWO;
        case 3:
            return NumberEmojis.THREE;
        case 4:
            return NumberEmojis.FOUR;
        case 5:
            return NumberEmojis.FIVE;
        case 6:
            return NumberEmojis.SIX;
        case 7:
            return NumberEmojis.SEVEN;
        case 8:
            return NumberEmojis.EIGHT;
        case 9:
            return NumberEmojis.NINE;
        case 10:
            return NumberEmojis.TEN;
    }
};

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
};

export enum PointsAction {
    ADD = 'add',
    SUBTRACT = 'subtract'
}

export const extractMessageInformationAndProcessPoints = async (
    reaction: MessageReaction | PartialMessageReaction,
    server?: Guild,
    privateSubmissionsChannel?: Channel,
    pointsAction: PointsAction = PointsAction.ADD,
    clientId?: string,
    user?: User | PartialUser
) => {
    const message = await reaction.message.fetch();
    const hasReaction = message.reactions.cache.find((x) => [...x.users.cache.filter((y) => y.id !== clientId).values()].length > 1);
    if (hasReaction && user && pointsAction === PointsAction.ADD) {
        await reaction.users.remove(user as User);
        return;
    }
    if (hasReaction && pointsAction === PointsAction.SUBTRACT) {
        return;
    }
    const userId = message.content.replace('<@', '').slice(0, -1);
    const points = await processPoints(reaction.emoji, userId, pointsAction, user?.id ?? '', PointType.REACTION);
    const serverMember = server?.members.cache.get(userId);
    if (points && privateSubmissionsChannel && privateSubmissionsChannel.type === ChannelType.GuildText) {
        try {
            await privateSubmissionsChannel.send(`<@${userId}> now has ${points} points`);
            pointsAction === PointsAction.ADD
                ? await message.react(whiteCheckEmoji)
                : await message.reactions.cache.find((x) => x.emoji.name === whiteCheckEmoji)?.remove();
            if (serverMember) {
                await modifyNicknamePoints(points, serverMember);
            }
        } catch (e) {
            if (e instanceof NicknameLengthException) {
                await privateSubmissionsChannel.send(
                    'Nickname is either too long or will be too long. Must be less than or equal to 32 characters.'
                );
                return;
            } else {
                await privateSubmissionsChannel.send(`Unable to modify points or nickname for <@${userId}>`);
                return;
            }
        }
    }
};
const processPoints = async (
    emoji: Emoji,
    userDiscordId: string,
    action: PointsAction = PointsAction.ADD,
    sourceDiscordId: string,
    pointsType: PointType
) => {
    const pointValue = convertEmojiToNumber(emoji);
    if (pointValue) {
        try {
            const user = await getUser(userDiscordId);
            if (!user) {
                return null;
            }
            const newPoints = await modifyPoints(user, pointValue, action, sourceDiscordId, pointsType);
            return newPoints;
        } catch (e) {
            console.error(e);
        }
    }
    return null;
};

export const reactWithBasePoints = async (message: Message) => {
    // stupid that i can't pass an array.
    // await message.react(NumberEmojis.ONE);
    // await message.react(NumberEmojis.TWO);
    await message.react(NumberEmojis.THREE);
    // await message.react(NumberEmojis.FOUR);
    // await message.react(NumberEmojis.FIVE);
    // await message.react(NumberEmojis.SIX);
    await message.react(NumberEmojis.SEVEN);
    // await message.react(NumberEmojis.EIGHT);
    // await message.react(NumberEmojis.NINE);
    await message.react(NumberEmojis.TEN);
};
