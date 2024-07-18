import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const privateKey = Buffer.from(process.env.GOOGLE_API_PRIVATE_KEY ?? '', 'base64')
    .toString()
    .replace(/\\n/g, '\n');
const auth = new google.auth.GoogleAuth({
    credentials: {
        type: 'service_account',
        project_id: 'iron-relax',
        private_key_id: process.env.GOOGLE_API_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.GOOGLE_API_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_API_CLIENT_ID,
        token_url: 'https://oauth2.googleapis.com/token',
        universe_domain: 'googleapis.com'
    },
    //url to spreadsheets API
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
});

const sheetsInstance = google.sheets({ version: 'v4', auth: auth });

export const fetchPointsData = async () => {
    const res = await sheetsInstance.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.GOOGLE_SHEETS_POINTS_ID ?? '',
        range: 'ItemPoints!A:B'
    });
    return res.data?.values;
};
