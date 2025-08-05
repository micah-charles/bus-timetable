const express = require('express');
const fetch = require('node-fetch');
const { formatInTimeZone } = require('date-fns-tz');
const app = express();
const port = process.env.PORT || 3000;

const API_KEY = process.env.TFL_TOKEN || 'missing-tfl-token';

// Define the bus stops and display names
const STOPS = {
    '490005056D': 'Cheam Broadway Stop D',
    '490009451N': 'Lumley Road Stop N',
    '490003909N': 'Kingston / Wood Street Stop N'
};

// Root page: show 3 hyperlinks
app.get('/', (req, res) => {
    const links = Object.entries(STOPS)
        .map(([id, name]) => `<li><a href="/stop/${id}">${name}</a></li>`)
        .join('');

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bus Timetable</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin: 20px; font-size: 18px; }
                ul { list-style: none; padding: 0; }
                li { margin: 10px 0; }
                a { text-decoration: none; color: blue; }
            </style>
        </head>
        <body>
            <h1>Select a Bus Stop</h1>
            <ul>${links}</ul>
        </body>
        </html>
    `);
});

// Page for a specific stop
app.get('/stop/:stopId', async (req, res) => {
    const stopId = req.params.stopId;
    const stopName = STOPS[stopId] || stopId;

    try {
        const response = await fetch(
            `https://api.tfl.gov.uk/StopPoint/${stopId}/Arrivals?app_key=${API_KEY}`,
            { timeout: 10000 }
        );
        const data = await response.json();

        const relevantBuses = data
            .filter(bus => (bus.lineId === 'SL7' || bus.lineId === '213') &&
                           bus.destinationName.includes('Kingston'))
            .sort((a, b) => a.timeToStation - b.timeToStation);

        let output = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${stopName} SL7/213</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin: 10px; font-size: 18px; }
                    h1 { font-size: 20px; }
                    #busTimes { margin-top: 20px; line-height: 1.5; max-width: 240px; margin: auto; }
                </style>
            </head>
            <body>
                <h1>Next SL7/213 from ${stopName}</h1>
                <p>Time and minutes to Kingston</p>
                <div id="busTimes">
        `;

        if (relevantBuses.length === 0) {
            output += 'No SL7 or 213 buses found.';
        } else {
            relevantBuses.slice(0, 5).forEach(bus => {
                const minutesToArrival = Math.floor(bus.timeToStation / 60);
                const arrivalTime = new Date(bus.expectedArrival);
                const timeString = formatInTimeZone(arrivalTime, 'Europe/London', 'HH:mm');
                output += `${bus.lineId} to ${bus.destinationName}: ${timeString} (${minutesToArrival} min)<br>`;
            });
        }

        const now = new Date();
        const debugTime = formatInTimeZone(now, 'Europe/London', 'HH:mm z');
        output += `
                </div>
                <p>Current time (BST): ${debugTime}</p>
                <p><a href="/stop/${stopId}">Refresh</a> | <a href="/">Back</a></p>
            </body>
            </html>
        `;

        res.send(output);
    } catch (error) {
        console.error(error);
        res.send(`<h1>Error</h1><p>Could not load bus times. <a href="/">Back</a></p>`);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
