import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const GEOSERVER_URL = 'http://localhost:8080/geoserver/rest';
const WORKSPACE = 'WebGIS';
const USER = 'admin';
const PASS = 'geoserver';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const STYLE_NAME = 'transfer_dynamic';
const SLD_FILE = path.join(__dirname, '../geoserver_styles/land_transfer/transfer_dynamic.sld');

async function main() {
    console.log(`[SLD Upload] Target Workspace: ${WORKSPACE}`);
    console.log(`[SLD Upload] Style Name: ${STYLE_NAME}`);

    // 1. 读取 SLD 文件
    if (!fs.existsSync(SLD_FILE)) {
        console.error(`[Error] SLD file not found: ${SLD_FILE}`);
        process.exit(1);
    }
    const sldContent = fs.readFileSync(SLD_FILE, 'utf8');
    console.log(`[SLD Upload] Read ${sldContent.length} bytes from file.`);

    // 2. 检查样式是否存在
    let exists = false;
    try {
        const checkRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles/${STYLE_NAME}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });
        if (checkRes.ok) exists = true;
    } catch (e) { }

    // 3. 创建样式元数据 (POST)
    if (!exists) {
        console.log('[SLD Upload] Creating style metadata...');
        try {
            // GeoServer REST API for creating a style in a workspace requires XML
            const createXml = `<style><name>${STYLE_NAME}</name><filename>${STYLE_NAME}.sld</filename></style>`;

            const createRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles`, {
                method: 'POST',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'application/xml'
                },
                body: createXml
            });

            if (createRes.ok || createRes.status === 201) {
                console.log('[SLD Upload] Style metadata created successfully.');
            } else {
                const errText = await createRes.text();
                console.error(`[SLD Upload] Failed to create style metadata: ${createRes.status}`);
                console.error(errText);
                return;
            }
        } catch (err) {
            console.error('[SLD Upload] Creation request failed:', err.message);
            return;
        }
    } else {
        console.log('[SLD Upload] Style already exists, proceeding to update content...');
    }

    // 4. 上传样式内容 (PUT)
    try {
        console.log('[SLD Upload] Uploading SLD content...');
        // Endpoint: /workspaces/{ws}/styles/{style} (PUT raw SLD body)
        const updateRes = await fetch(`${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles/${STYLE_NAME}`, {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/vnd.ogc.sld+xml'
            },
            body: sldContent
        });

        if (updateRes.ok) {
            console.log('[SLD Upload] Success! Style content updated.');
        } else {
            const errText = await updateRes.text();
            console.error(`[SLD Upload] Failed to upload content: ${updateRes.status}`);
            console.error('Response:', errText);
            process.exit(1);
        }

    } catch (err) {
        console.error('[SLD Upload] Upload request failed:', err.message);
        process.exit(1);
    }
}

main().catch(console.error);
