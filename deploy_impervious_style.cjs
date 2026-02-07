const http = require('http');
const fs = require('fs');
const path = require('path');

const GEOSERVER_URL = 'localhost';
const GEOSERVER_PORT = 8080;
const USERNAME = 'admin';
const PASSWORD = 'geoserver';
const AUTH = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
const WORKSPACE = 'WebGIS';

async function uploadStyle(styleName) {
    const sldPath = path.join(__dirname, 'geoserver_styles', `${styleName}.sld`);

    if (!fs.existsSync(sldPath)) {
        console.error(`[ERROR] SLD file not found: ${sldPath}`);
        return false;
    }

    const sldContent = fs.readFileSync(sldPath, 'utf8');
    console.log(`[INFO] Uploading style: ${styleName}`);

    // Step 1: Check if style exists and delete it
    const checkExists = await makeRequest('GET', `/geoserver/rest/styles/${styleName}.json`);
    if (checkExists.status === 200) {
        console.log(`[INFO] Style ${styleName} exists, deleting first...`);
        await makeRequest('DELETE', `/geoserver/rest/styles/${styleName}?purge=true`);
    }

    // Step 2: Create new style
    const createResult = await makeRequest('POST', '/geoserver/rest/styles',
        JSON.stringify({ style: { name: styleName, filename: `${styleName}.sld` } }),
        { 'Content-Type': 'application/json' }
    );

    if (createResult.status !== 201 && createResult.status !== 200) {
        console.error(`[ERROR] Failed to create style: ${createResult.status} ${createResult.body}`);
        return false;
    }

    // Step 3: Upload SLD content
    const uploadResult = await makeRequest('PUT', `/geoserver/rest/styles/${styleName}`,
        sldContent,
        { 'Content-Type': 'application/vnd.ogc.sld+xml' }
    );

    if (uploadResult.status !== 200) {
        console.error(`[ERROR] Failed to upload SLD: ${uploadResult.status} ${uploadResult.body}`);
        return false;
    }

    console.log(`[SUCCESS] Style ${styleName} uploaded successfully!`);
    return true;
}

function makeRequest(method, path, body = null, additionalHeaders = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: GEOSERVER_URL,
            port: GEOSERVER_PORT,
            path: path,
            method: method,
            headers: {
                'Authorization': `Basic ${AUTH}`,
                ...additionalHeaders
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    console.log('=== GeoServer Style Deployment ===\n');

    // Deploy impervious_dynamic style
    await uploadStyle('impervious_dynamic');

    console.log('\n=== Deployment Complete ===');
}

main().catch(console.error);
