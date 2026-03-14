import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GeoServer Configuration
const GEOSERVER_URL = 'http://localhost:8080/geoserver/rest';
const WORKSPACE = 'WebGIS';
const USER = 'admin';
const PASS = 'geoserver';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

// Directory containing SLD files
const STYLES_ROOT = path.join(__dirname, '../../geoserver_styles');

/**
 * Upload a single SLD file to GeoServer
 */
async function uploadSld(styleName, sldPath) {
    console.log(`\n[Sync] Processing style: ${styleName}`);

    if (!fs.existsSync(sldPath)) {
        console.error(`[Error] File not found: ${sldPath}`);
        return;
    }

    const sldContent = fs.readFileSync(sldPath, 'utf8');

    // 1. Check if style exists in workspace
    let exists = false;
    try {
        const checkRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles/${styleName}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });
        if (checkRes.ok) exists = true;
    } catch (e) {
        console.error(`[Error] Failed to check status for ${styleName}:`, e.message);
    }

    // 2. Create style metadata if it doesn't exist
    if (!exists) {
        console.log(`[Sync] Creating metadata for ${styleName}...`);
        try {
            const createXml = `<style><name>${styleName}</name><filename>${styleName}.sld</filename></style>`;
            const createRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles`, {
                method: 'POST',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'application/xml'
                },
                body: createXml
            });

            if (!createRes.ok && createRes.status !== 201) {
                const errText = await createRes.text();
                console.error(`[Error] Failed to create metadata: ${createRes.status} - ${errText}`);
                return;
            }
        } catch (err) {
            console.error(`[Error] Metadata creation request failed:`, err.message);
            return;
        }
    }

    // 3. Upload SLD content
    try {
        console.log(`[Sync] Uploading SLD body for ${styleName}...`);
        const updateRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles/${styleName}`, {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/vnd.ogc.sld+xml'
            },
            body: sldContent
        });

        if (updateRes.ok) {
            console.log(`[Sync] SUCCESS: ${styleName} updated.`);
        } else {
            const errText = await updateRes.text();
            console.error(`[Error] Failed to upload ${styleName}: ${updateRes.status} - ${errText}`);
        }
    } catch (err) {
        console.error(`[Error] Upload request failed:`, err.message);
    }
}

/**
 * Recursively find all .sld files in the styles directory
 */
function findSldFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findSldFiles(filePath, fileList);
        } else if (file.endsWith('.sld')) {
            const styleName = path.basename(file, '.sld');
            fileList.push({ name: styleName, path: filePath });
        }
    });
    return fileList;
}

async function main() {
    console.log('=== GeoServer SLD Sync Tool ===');
    console.log(`Scanning: ${STYLES_ROOT}`);

    if (!fs.existsSync(STYLES_ROOT)) {
        console.error('[Error] Styles directory not found!');
        process.exit(1);
    }

    const sldFiles = findSldFiles(STYLES_ROOT);
    console.log(`Found ${sldFiles.length} styles to sync.\n`);

    for (const sld of sldFiles) {
        await uploadSld(sld.name, sld.path);
    }

    console.log('\n=== Sync Completed ===');
}

main().catch(console.error);
