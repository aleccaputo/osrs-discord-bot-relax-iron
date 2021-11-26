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
        question: 'How long have you played RuneScape?',
        order: 4
    },
    {
        question: 'What content in OSRS do you enjoy the most? (Cox,Tob,Corp,GWD, etc;)',
        order: 5
    },
    {
        question: 'How did you hear about Iron Relax?',
        order: 6
    },
    {
        question: 'What are you looking for in a clan?',
        order: 7
    },
    {
        question: 'Are you 18 or older?',
        order: 8
    }
]

export interface IApplicationQuestionAnswer extends IApplicationQuestion {
    answer: string;
}