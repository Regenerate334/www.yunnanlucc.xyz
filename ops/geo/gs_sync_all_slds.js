/**
 * ================================================================================
 * @File    :   gs_sync_all_slds.js
 * @Desc    :   全自动同步本地 geoserver_styles 目录下所有 SLD 文件至远程 GeoServer。
 *              实现本地样式库与生产环境的一键对齐。
 * @Usage   :   node ops/geo/gs_sync_all_slds.js
 * @Deps    :   dotenv, fs, path
 * ================================================================================
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GeoServer Configuration - 采用 .env 中的真实账号
const GEOSERVER_URL = 'http://localhost:8080/geoserver/rest';
const WORKSPACE = 'WebGIS';
const USER = process.env.GEOSERVER_USER;
const PASS = process.env.GEOSERVER_PASSWORD;
if (!USER || !PASS) {
    console.error('ERROR: GEOSERVER_USER or GEOSERVER_PASSWORD not set in .env');
    process.exit(1);
}
const AUTH_HEADER = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const STYLES_ROOT = path.join(__dirname, '../../geoserver_styles');

async function uploadSld(styleName, sldPath) {
    const sldContent = fs.readFileSync(sldPath, 'utf8');
    let exists = false;
    try {
        const checkRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles/${styleName}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });
        if (checkRes.ok) exists = true;
    } catch (e) { }

    if (!exists) {
        console.log(`[Sync] Creating ${styleName}...`);
        await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles`, {
            method: 'POST',
            headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/xml' },
            body: `<style><name>${styleName}</name><filename>${styleName}.sld</filename></style>`
        });
    }

    const updateRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles/${styleName}`, {
        method: 'PUT',
        headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/vnd.ogc.sld+xml' },
        body: sldContent
    });
    console.log(`[Sync] ${styleName}: ${updateRes.status}`);
}

function findSldFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) findSldFiles(filePath, fileList);
        else if (file.endsWith('.sld')) fileList.push({ name: path.basename(file, '.sld'), path: filePath });
    });
    return fileList;
}

async function main() {
    console.log('[Sync] Started SLD Synchronization...');
    const sldFiles = findSldFiles(STYLES_ROOT);
    for (const sld of sldFiles) {
        await uploadSld(sld.name, sld.path);
    }
    console.log('All styles synced.');
}

main().catch(console.error);
