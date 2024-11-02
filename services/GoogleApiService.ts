import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { parse } from 'fast-csv';
import fs from 'fs';

dotenv.config();

const isDev = process.env.NODE_ENV === 'dev';

const privateKey = !isDev
    ? Buffer.from(process.env.GOOGLE_API_PRIVATE_KEY ?? '', 'base64')
          .toString()
          .replace(/\\n/g, '\n')
    : null;
const auth =
    !isDev && privateKey
        ? new google.auth.GoogleAuth({
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
          })
        : null;

const sheetsInstance = !isDev && auth ? google.sheets({ version: 'v4', auth: auth }) : null;

export const fetchPointsData = async () => {
    if (!sheetsInstance) {
        console.log('here');
        return readCsv('./localPointList.csv');
    }
    const res = await sheetsInstance?.spreadsheets.values.get({
        auth: auth ?? '',
        spreadsheetId: process.env.GOOGLE_SHEETS_POINTS_ID ?? '',
        range: 'ItemPoints!A:B'
    });
    return res?.data?.values;
};

async function readCsv(filePath: string) {
    const data = [];

    const stream = fs.createReadStream(filePath).pipe(parse({ headers: false }));

    for await (const row of stream) {
        data.push(row); // Each row is a key-value pair object
    }

    return data;
}
