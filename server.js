const express = require('express');
const fetch = require('node-fetch');
const { formatInTimeZone } = require('date-fns-tz');
const app = express();
const port = process.env.PORT || 3000;

const API_KEY = process.env.TFL_TOKEN || 'missing-tfl-token';

// Define stops with flag and name
const STOPS = {
    '490005056D': { flag: 2, name: 'Cheam Broadway Stop D' },
    '490009451N': { flag: 4, name: 'Lumley Road Stop N' },
    '490001346C': { flag: 8, name: 'Worcester Park Station (Stop C)' },
    '490015206K': { flag: 16, name: 'New Malden / the Fountain stop K' },
    '490015206L': { flag: 32, name: 'New Malden / Kingston Road (Stop L)' },
    '490003909N': { flag: 64, name: 'Kingston / Wood Street Stop N' },
    '490013664C1': { flag: 128, name: 'Tiffin School / London Road Stop B' },
    '40004405129A': { flag: 256, name: 'Esher Road' },
    '490010323G': { flag: 512, name: 'North Cheam / London Road Stop G' },
    '490010725S': { flag: 1024, name: 'Pagoda Avenue (Stop RF)' }
};

// Map site to combined flags
const SITE_FLAGS = {
    Cheam: 2 + 4 + 64 + 128 + 256 + 512,
    WorcesterPark: 8 + 64 + 128 + 256,
    NewMalden: 16 + 32 + 64 + 128 + 256,
    Richmond: 1024   
};

// Home page: filter by site param
app.get('/', (req, res) => {
const site = req.query.site;
const activeFlag = SITE_FLAGS[site];

let filteredStops;
if (activeFlag !== undefined) {
    // Valid site param: filter stops by bitmask
    filteredStops = Object.entries(STOPS).filter(([id, data]) => (data.flag & activeFlag) !== 0);
} else {
    // No site param or invalid site: show all
    filteredStops = Object.entries(STOPS);
}

const links = filteredStops
    .map(([id, data]) => `<li><a href="/stop/${id}">${data.name}</a></li>`)
    .join('');

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bus Timetable - ${site}</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin: 20px; font-size: 18px; }
                ul { list-style: none; padding: 0; }
                li { margin: 10px 0; }
                a { text-decoration: none; color: blue; }
            </style>
        </head>
        <body>
            <h1>Select a Bus Stop${site ? ` (${site})` : ''}</h1>
            <ul>${links}</ul>
            <p>
                View site: 
                <a href="/?site=Cheam">Cheam</a> | 
                <a href="/?site=WorcesterPark">WorcesterPark</a> | 
                <a href="/?site=NewMalden">NewMalden</a> | 
                <a href="/?site=Richmond">Richmond</a>
            </p>
        </body>
        </html>
    `);
});

// Page for a specific stop
app.get('/stop/:stopId', async (req, res) => {
    const stopId = req.params.stopId;
    const stopMeta = STOPS[stopId];
    const stopName = stopMeta ? stopMeta.name : stopId;

    try {
        const response = await fetch(
            `https://api.tfl.gov.uk/StopPoint/${stopId}/Arrivals?app_key=${API_KEY}`,
            { timeout: 10000 }
        );
        const data = await response.json();

        const relevantBuses = data.sort((a, b) => a.timeToStation - b.timeToStation);

        let output = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${stopName}</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin: 10px; font-size: 18px; }
                    h1 { font-size: 20px; }
                    #busTimes { margin-top: 20px; line-height: 1.5; max-width: 240px; margin: auto; }
                </style>
            </head>
            <body>
                <h1>Next Buses from ${stopName}</h1>
                <div id="busTimes">
        `;

        if (relevantBuses.length === 0) {
            output += 'No buses found.';
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
