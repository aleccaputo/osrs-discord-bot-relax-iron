interface IApplicationQuestion {
    question: string;
    order: number;
}

export const ApplicationQuestions: Array<IApplicationQuestion> = [
    {
        question: 'What is your OSRS Username?',
        order: 1
    },
    {
        question: 'What is your combat level?',
        order: 2
    },
    {
        question: 'What is your total level?',
        order: 3
    },
    {
        question: 'What gamemode are you playing? (Iron/HC Iron/Ultimate/Group',
        order: 4
    },
    {
        question: 'How long have you played RuneScape?',
        order: 5
    },
    {
        question: 'What content in OSRS do you enjoy the most? (Pvm / skilling etc)',
        order: 6
    },    {
        question: 'What kind of events are you interested in?',
        order: 7
    },
    {
        question: 'How did you hear about Iron Relax?',
        order: 8
    },
    {
        question: 'What are you looking for in a clan?',
        order: 9
    },
    {
        question: 'Are you already in the Clan chat?\n',
        order: 10
    },
    {
        question: 'Are you 18 or older?',
        order: 11
    },
    {
        question: 'Where are you from? (EU/USA/ETC)',
        order: 12
    }
]

export interface IApplicationQuestionAnswer extends IApplicationQuestion {
    answer: string;
}