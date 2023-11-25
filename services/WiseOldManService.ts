import fetch from 'node-fetch';

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
