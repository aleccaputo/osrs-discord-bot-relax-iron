import { Channel, ChannelType, Emoji, Guild, Message, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import { getUser, modifyNicknamePoints, modifyPoints } from './UserService';
import { NicknameLengthException } from '../exceptions/NicknameLengthException';
import { PointType } from '../models/PointAudit';
import { formatDiscordUserTag } from './MessageHelpers';
import { ItemNotFoundException } from '../exceptions/ItemNotFoundException';

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
    const points = await processPoints(reaction.emoji, userId, pointsAction, user?.id ?? '', PointType.REACTION, reaction.message.id);
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
    pointsType: PointType,
    messageId: string
) => {
    const pointValue = convertEmojiToNumber(emoji);
    if (pointValue) {
        try {
            const user = await getUser(userDiscordId);
            if (!user) {
                return null;
            }
            const newPoints = await modifyPoints(user, pointValue, action, sourceDiscordId, pointsType, messageId);
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

export const processNonembedDinkPost = async (message: Message, pointsSheetLookup: Record<string, string>) => {
    // Handle submissions that are not embeded
    // console.log(message);
    console.debug(message.content);

    if (message.channel.type !== ChannelType.GuildText) {
        console.error("The message was not posted in the correct channel: ", message.channel.type);
        return;
    }

    const matches = message.content.match(/\*\*([\s\S]*?)\*\*/g);
    console.debug("Matches: ", matches);

    if (matches === null) {
        console.error("No bold text found in the message content: ", message.content);
        return;
    }

    const pieces = matches.map(part => part.replace(/\*/g, '')).filter(part => (part.length > 0 && !part.includes('*')));
    console.debug("Pieces: ", pieces);

    if (pieces.length === 1 && message.content.includes("** just got a pet!")) {
        // Add "1 x " & " ()" so it matches the expected input later
        pieces[1] = "1 x Pet ()";
        // Could add a lookup here to get the source of the pet
        // The "Pet" section of dink does not have the %SOURCE% parameter available
        pieces[2] = "unknown";
    } else if (pieces.length !== 3) {
        console.error("The message did not return 3 pieces: ", pieces);
        return;
    }

    const player = pieces[0];
    const loot = pieces[1].split("\n").map(piece => ({
        'item': piece.substring(piece.indexOf(" ", 2) + 1, piece.lastIndexOf(" ")),
        'quantity': parseInt(piece.substring(0, piece.indexOf(" ", 1)))
    }));
    const source = pieces[2];

    console.debug("Player: ", player);
    console.debug("Loot: ", loot);
    console.debug("Source: ", source);
    
    const allUsers = await message?.guild?.members.fetch();
    const possibleUser = allUsers?.find((x) => (x.nickname ?? '').toLocaleLowerCase().startsWith(player.toLocaleLowerCase()));

    console.debug("Possible user: ", possibleUser);
    
    if (!possibleUser) {
        console.error("No possible user found: ", possibleUser);
        return;
    }

    if (loot.length === 0) {
        console.error("No loot found: ", loot);
        return;
    }

    const valid_loot: Array<{name: string; points: number; quantity: number}> = [];
    let points_to_add = 0;

    for (let i = 0; i < loot.length; ++i) {
        const item_name = loot[i].item.toLocaleLowerCase();
        if (!(item_name in pointsSheetLookup)) {
            console.warn(`${loot[i].item} (${item_name}) does not exist on the list of items that are eligible!`);
            continue;
        }

        const points = parseInt(pointsSheetLookup[item_name]);

        points_to_add += points * loot[i].quantity;
        valid_loot.push({
            name: loot[i].item,
            points: points,
            quantity: loot[i].quantity
        });
    }

    if (valid_loot.length === 0) {
        console.error("No items are worth points: ", valid_loot);
        return;
    }

    const db_user = await getUser(possibleUser.id);
    // const current_points = db_user?.points;
    const new_points = await modifyPoints(
        db_user,
        points_to_add,
        PointsAction.ADD,
        message.author.id,
        PointType.AUTOMATED,
        message.id
    );

    if (new_points === null) {
        console.error("Could not modify points: ", valid_loot, db_user, new_points);
        return;
    }

    console.debug("Modified points: ", new_points);
    await modifyNicknamePoints(new_points, possibleUser);

    let formattedConfirmationString = '';
    valid_loot.forEach((x) => {
        formattedConfirmationString += `${x.quantity} x ${x.name} (${x.points}) is ${x.points * x.quantity} points. <@${possibleUser.id}> now has ${new_points} points.\n`;
    });

    await message.channel.send(
        formattedConfirmationString ||
            `new points: ${new_points}, but for some reason i can't tell you the formatted string...`
    );
}

/**
 * picks apart an embed from the Dink bot, looks up the number of points, and then gives them to the user
 * @param message the Discord.Message that was sent and contains the embed
 * @param pointsSheetLookup A Record<string, string> containing {itemName: pointValue}
 */
export const processDinkPost = async (message: Message, pointsSheetLookup: Record<string, string>) => {
    const embed = message.embeds[0];
    const embedDescription = embed.description;
    console.log(embed);
    const item =
        embedDescription?.trim().includes("has a funny feeling like they're being followed") ||
        embedDescription?.trim() == "Would've gotten a pet, but already has it."
            ? 'pet'
            : embed.description
                  ?.match(/\[(.*?)\]/g)
                  ?.map((str) => str.slice(1, -1))
                  .slice(0, -1); // removes the []. splice removes the item source
    const user = embed.author?.name;
    if (user) {
        // check that it matches the nickname scheme in the server to only ever match one ie Nickname [
        const allUsers = await message?.guild?.members.fetch();
        const possibleUser = allUsers?.find((x) => (x.nickname ?? '').toLocaleLowerCase().startsWith(`${user.toLocaleLowerCase()}`));
        // if i have an item and i found a user in the discord server
        if (item && possibleUser) {
            if (message.channel.type === ChannelType.GuildText) {
                const allItemsStripped = item === 'pet' ? [item] : item.map((x) => x.replace(/\[|\]/g, '').toLocaleLowerCase());
                let foundLookup: Array<{ name: string; points: string }> = [];
                for (const itemName of allItemsStripped) {
                    const foundItem = pointsSheetLookup[itemName];
                    if (foundItem) {
                        foundLookup.push({
                            name: itemName,
                            points: foundItem
                        });
                    }
                }

                // i found an item, now modify the backing user points
                if (foundLookup.length) {
                    const dbUser = await getUser(possibleUser.id);
                    const totalPoints = foundLookup.reduce((acc, cur) => acc + parseInt(cur.points), 0);
                    const newPoints = await modifyPoints(
                        dbUser,
                        totalPoints,
                        PointsAction.ADD,
                        message.author.id,
                        PointType.AUTOMATED,
                        message.id
                    );
                    if (newPoints) {
                        await modifyNicknamePoints(newPoints, possibleUser);
                        let formattedConfirmationString = '';
                        foundLookup.forEach((x) => {
                            formattedConfirmationString += `${x.name} is ${x.points} points. <@${possibleUser.id}> now has ${newPoints} points.\n`;
                        });
                        await message.channel.send(
                            formattedConfirmationString ||
                                `new points: ${newPoints}, but for some reason i can't tell you the formatted string...`
                        );
                    }
                } else {
                    console.info(`No item matching ${allItemsStripped.toString()}`);
                    throw new ItemNotFoundException(
                        `No item matching ${allItemsStripped.toString()}. Points not given to ${formatDiscordUserTag(
                            possibleUser.id
                        )}. Please manually check ${message.url}`
                    );
                }
            }
        } else {
            console.log(`No user found in discord matching in game name: ${user}.`);
            throw new ItemNotFoundException(`No user found in discord matching in game name: ${user}.`);
        }
    } else {
        console.error('no user found on embed');
        throw new ItemNotFoundException('no user found on embed');
    }
};
