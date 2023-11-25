interface IAwardQuestion {
    question: string;
    order: number;
}

export const AwardQuestions: Array<IAwardQuestion> = [
    {
        question: 'Member of the Year',
        order: 1
    },
    {
        question: 'Best Pvmer',
        order: 2
    },
    {
        question: 'Favorite Mod/Admin/Owner Rank',
        order: 3
    },
    {
        question: 'Best Personality',
        order: 4
    },
    {
        question: 'Favorite Newcomer(joined in 2021)',
        order: 5
    },
    {
        question: 'Favorite Clan Member',
        order: 6
    },
    {
        question: 'Most Elitist',
        order: 7
    },
    {
        question: 'Biggest Simp',
        order: 8
    },
    {
        question: 'Biggest Keyboard Warrior',
        order: 10
    },
    {
        question: 'Funniest',
        order: 11
    },
    {
        question: 'Biggest Spoon',
        order: 12
    },
    {
        question: 'Biggest Troll',
        order: 13
    },
    {
        question: 'Best Coach',
        order: 14
    },
    {
        question: 'Most Helpful',
        order: 15
    },
    {
        question: 'Most Potential',
        order: 16
    },
    {
        question: 'Most Improved',
        order: 17
    },
    {
        question: 'Most Active',
        order: 18
    },
    {
        question: 'Most Degenerate Staker',
        order: 19
    },
    {
        question: 'Best Pker',
        order: 20
    },
    /*    {
        question: 'Best Bromance',
        order: 21
    },*/
    {
        question: 'Biggest Weeb',
        order: 22
    },
    {
        question: 'Biggest Tool of 2021',
        order: 23
    },
    {
        question: '#1 Planker',
        order: 24
    },
    {
        question: 'Cutest Noob',
        order: 25
    }
];

export interface IAwardQuestionAnswer extends IAwardQuestion {
    answer: string;
}
