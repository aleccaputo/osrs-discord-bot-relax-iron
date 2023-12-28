import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const auth = new google.auth.GoogleAuth({
    keyFile: 'google-api.json', //the key file
    //url to spreadsheets API
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
});

const sheetsInstance = google.sheets({ version: 'v4', auth: auth });

export const fetchPointsData = async () => {
    const res = await sheetsInstance.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.GOOGLE_SHEETS_POINTS_ID ?? '',
        range: 'Blad1!A:B'
    });
    return res.data?.values;
};
