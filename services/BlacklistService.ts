import Blacklist from '../models/Blacklist';
import { BlacklistRecordExistsException } from '../exceptions/BlacklistRecordExistsException';

export const blacklistUserByInGameName = async (name: string, reason: string, additionalInformation?: Map<string, string>) => {
    const lowercaseName = name.toLowerCase();
    const alreadyExistingRecord = await Blacklist.findOne({ inGameName: lowercaseName});

    if (alreadyExistingRecord !== null) {
        console.error(`User ${name} is already blacklisted`);
        throw new BlacklistRecordExistsException(`User ${name}} is already blacklisted`);
    }

    await new Blacklist({
        inGameName: lowercaseName,
        reason: reason,
        additionalInformation: additionalInformation
    }).save();
};

export const isUserBlacklisted = async (name: string) => {
    const lowercaseName = name.toLowerCase();
    const record = await Blacklist.findOne({ inGameName: lowercaseName });
    return record !== null;
}