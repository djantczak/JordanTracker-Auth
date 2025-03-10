const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Endpoint to handle Strava authentication callback
app.get('/auth/strava/callback', async (req, res) => {
    const authorizationCode = req.query.code;
    
    if (!authorizationCode) {
        return res.status(400).send('No authorization code received.');
    }

    try {
        // Exchange authorization code for access token
        const response = await axios.post('https://www.strava.com/oauth/token', null, {
            params: {
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                code: authorizationCode,
                grant_type: 'authorization_code'
            }
        });

        const { access_token, refresh_token, athlete, expires_at, scope } = response.data;
        const athleteId = athlete.id;
        const athleteName = `${athlete.firstname} ${athlete.lastname}`;

        console.log(`Received athlete: ${athleteName}`);

        // Save to Google Sheets
        await saveToGoogleSheet(athleteId, athleteName, access_token, refresh_token, expires_at, scope);

        res.send('Authorization successful! Data saved.');
    } catch (error) {
        console.error('Error exchanging auth code:', error.response?.data || error.message);
        res.status(500).send('Error during authorization.');
    }
});

// Function to save tokens and user data to Google Sheets
async function saveToGoogleSheet(athleteId, athleteName, accessToken, refreshToken, expiresAt, scope) {
    try {
        // Initialize Google Auth (ensuring fresh auth context)
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const range = 'Sheet1!A:F'; // Adjust based on your sheet

        const values = [[athleteId, athleteName, accessToken, refreshToken, expiresAt, scope]];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values },
        });

        console.log('Data saved to Google Sheets');
    } catch (error) {
        console.error('Error saving data:', error.response?.data || error.message);
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
