const express = require('express');
const fetch = require('node-fetch');
const { formatInTimeZone } = require('date-fns-tz');
const app = express();
const port = process.env.PORT || 3000;

const API_KEY = process.env.TFL_TOKEN || 'missing-tfl-token'; // Fallback for local testing
const STOP_ID = '490005056D'; // Cheam Broadway Stop D ID

app.get('/', async (req, res) => {
    try {
        const response = await fetch(
            `https://api.tfl.gov.uk/StopPoint/${STOP_ID}/Arrivals?app_key=${API_KEY}`,
            { timeout: 10000 }
        );
        const data = await response.json();

        // Filter for SL7 and 213 to Kingston
        const relevantBuses = data.filter(bus =>
            (bus.lineId === 'SL7' || bus.lineId === '213') &&
            bus.destinationName.includes('Kingston')
        );

        // Sort by arrival time
        relevantBuses.sort((a, b) => a.timeToStation - b.timeToStation);

        // Generate HTML
        let output = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cheam Broadway SL7/213</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        margin: 10px;
                        font-size: 18px;
                    }
                    h1 {
                        font-size: 20px;
                    }
                    #busTimes {
                        margin-top: 20px;
                        line-height: 1.5;
                        max-width: 240px;
                        margin-left: auto;
                        margin-right: auto;
                    }
                </style>
            </head>
            <body>
                <h1>Next SL7/213 from Cheam Broadway</h1>
                <p>Time and minutes to Kingston</p>
                <div id="busTimes">
        `;

        if (relevantBuses.length === 0) {
            output += 'No SL7 or 213 buses found.';
        } else {
            relevantBuses.slice(0, 5).forEach(bus => {
                const minutesToArrival = Math.floor(bus.timeToStation / 60);
                const arrivalTime = new Date(bus.expectedArrival);
                const timeString = formatInTimeZone(
                    arrivalTime,
                    'Europe/London',
                    'HH:mm' // 24-hour format, e.g., 14:35
                );
                output += `${bus.lineId} to ${bus.destinationName}: ${timeString} (${minutesToArrival} min)<br>`;
            });
        }

        // Add debug info
        const now = new Date();
        const debugTime = formatInTimeZone(now, 'Europe/London', 'HH:mm z');
        output += `
                </div>
                <p>Current time (BST): ${debugTime}</p>
                <p><a href="/">Refresh</a></p>
            </body>
            </html>
        `;

        res.send(output);
    } catch (error) {
        console.error(error);
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin: 10px; font-size: 18px; }
                </style>
            </head>
            <body>
                <h1>Error</h1>
                <p>Could not load bus times. <a href="/">Try again</a>.</p>
            </body>
            </html>
        `);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
