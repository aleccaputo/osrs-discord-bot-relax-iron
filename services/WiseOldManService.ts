import fetch from 'node-fetch';
import {
    WOMClient
} from "@wise-old-man/utils";

const womClient = new WOMClient();

export const addMemberToWiseOldMan = async (inGameName: string): Promise<boolean | null> => {
    if (!process.env.WISE_OLD_MAN_GROUP_ID || !process.env.WISE_OLD_MAN_VERIFICATION_CODE) {
        return null;
    }

    const body = {
        verificationCode: process.env.WISE_OLD_MAN_VERIFICATION_CODE,
        members: [
            {
                username: inGameName,
                role: 'member'
            }
        ]
    };

    try {
        await fetch(`https://api.wiseoldman.net/groups/${parseInt(process.env.WISE_OLD_MAN_GROUP_ID, 10)}/add-members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

export const getGroupCompetitions = async () => {
    if (!process.env.WISE_OLD_MAN_GROUP_ID) {
        return null;
    }

    return await womClient.groups.getGroupCompetitions(parseInt(process.env.WISE_OLD_MAN_GROUP_ID, 10));
};

export const getCompetitionById = async (id: number) => {
    return womClient.competitions.getCompetitionDetails(id);
};
