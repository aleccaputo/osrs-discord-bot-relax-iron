import * as dotenv from 'dotenv';
dotenv.config();

interface Role {
    name: string;
    id: string;
    order: number;
}

export interface TimeRole extends Role {
    minMonths: number;
    maxMonths: number;
}

export const TimeRoles: Array<TimeRole> = [
    {
        name: 'Short Green Guy Rank',
        id: process.env.RANK_ONE_ID ?? '1',
        minMonths: 0,
        maxMonths: 1,
        order: 0
    },
    {
        name: 'Goblin Rank',
        id: process.env.RANK_TWO_ID ?? '2',
        minMonths: 1,
        maxMonths: 3,
        order: 1
    },
    {
        name: 'Bob Rank',
        id: process.env.RANK_THREE_ID ?? '3',
        minMonths: 3,
        maxMonths: 6,
        order: 2
    },
    {
        name: 'Imp Rank',
        id: process.env.RANK_FOUR_ID ?? '4',
        minMonths: 6,
        maxMonths: 10000,
        order: 3
    }
];

export interface PointsRole extends Role {
    minPoints: number;
    maxPoints: number;
}
export const PointsRoles: Array<PointsRole> = [
    {
        name: 'Sapphire',
        id: process.env.RANK_ONE_ID ?? '1',
        minPoints: 0,
        maxPoints: 100,
        order: 1
    },
    {
        name: 'Emerald',
        id: process.env.RANK_TWO_ID ?? '2',
        minPoints: 100,
        maxPoints: 200,
        order: 2
    },
    {
        name: 'Ruby',
        id: process.env.RANK_THREE_ID ?? '3',
        minPoints: 200,
        maxPoints: 300,
        order: 3
    },
    {
        name: 'Diamond',
        id: process.env.RANK_FOUR_ID ?? '4',
        minPoints: 300,
        maxPoints: 400,
        order: 4
    },
    {
        name: 'Dragonstone',
        id: process.env.RANK_FIVE_ID ?? '5',
        minPoints: 400,
        maxPoints: 600,
        order: 5
    },
    {
        name: 'Onyx',
        id: process.env.RANK_SIX_ID ?? '6',
        minPoints: 600,
        maxPoints: 800,
        order: 6
    },
    {
        name: 'Zenyte',
        id: process.env.RANK_SEVEN_ID ?? '8',
        minPoints: 800,
        maxPoints: 1000,
        order: 7
    },
    {
        name: 'Wrath',
        id: process.env.RANK_EIGHT_ID ?? '9',
        minPoints: 1000,
        maxPoints: 100000000,
        order: 8
    }
];
