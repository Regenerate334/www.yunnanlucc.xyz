import 'dotenv/config';
import fs from 'fs';

const GEOSERVER_URL = 'http://localhost:8080/geoserver/rest';
const WORKSPACE = 'WebGIS';
const USER = process.env.GEOSERVER_USER;
const PASS = process.env.GEOSERVER_PASSWORD;
if (!USER || !PASS) {
    console.error('ERROR: GEOSERVER_USER or GEOSERVER_PASSWORD not set in .env');
    process.exit(1);
}
const AUTH_HEADER = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

async function run() {
    const years = Array.from({ length: 2023 - 1985 + 1 }, (_, i) => 1985 + i);
    console.log(`[Restore] Starting layer restoration for years 1985-2023...`);

    for (const year of years) {
        const name = `clcd_${year}`;
        const tif = `CLCD_v01_${year}_albert_yunnan.tif`;

        console.log(`[Batch] Publishing ${name}...`);
        try {
            // 1. Store
            const storeXml = `<coverageStore><name>${name}</name><type>GeoTIFF</type><enabled>true</enabled><workspace>${WORKSPACE}</workspace><url>file:data/clcd_yunnan/${tif}</url></coverageStore>`;
            const sRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/coveragestores`, {
                method: 'POST',
                headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/xml' },
                body: storeXml
            });

            if (sRes.status === 201 || sRes.status === 200) {
                // 2. Coverage
                const covXml = `<coverage><name>${name}</name><srs>EPSG:4522</srs><projectionPolicy>REPROJECT_TO_DECLARED</projectionPolicy></coverage>`;
                const cRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/coveragestores/${name}/coverages`, {
                    method: 'POST',
                    headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/xml' },
                    body: covXml
                });

                // 3. Style
                await fetch(`${GEOSERVER_URL}/layers/WebGIS:${name}`, {
                    method: 'PUT',
                    headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/xml' },
                    body: `<layer><defaultStyle><name>clcd_standard</name></defaultStyle></layer>`
                });
                console.log(`[Batch] ${name} Success!`);
            } else if (sRes.status === 401) {
                console.error('AUTH FAILED! Check GEOSERVER_USER/PASSWORD in .env.');
                return;
            } else {
                const err = await sRes.text();
                console.log(`[Batch] ${name} failed store: ${sRes.status} ${err.substring(0, 50)}`);
            }
        } catch (e) {
            console.error(`[Batch] Error ${name}:`, e.message);
        }
    }
}

run();
