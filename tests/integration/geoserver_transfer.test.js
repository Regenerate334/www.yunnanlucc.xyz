/**
 * GeoServer 转移表 WMS 独立测试脚本
 * 用法: node server/scripts/test_geoserver_transfer.js
 * 
 * 测试内容:
 * 1. 检查 _transfer_sum 列是否存在
 * 2. 检查 GeoServer 是否发布了转移表图层
 * 3. 测试 WMS GetMap 请求
 * 4. 测试带 env 参数的 WMS GetMap 请求
 */

const BASE = 'http://localhost:8080/geoserver';
const WORKSPACE = 'WebGIS';

// ANSI 颜色
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function ok(msg) { console.log(`${GREEN}✅ ${msg}${RESET}`); }
function fail(msg) { console.log(`${RED}❌ ${msg}${RESET}`); }
function info(msg) { console.log(`${CYAN}ℹ️  ${msg}${RESET}`); }
function warn(msg) { console.log(`${YELLOW}⚠️  ${msg}${RESET}`); }

async function testDB() {
    info('--- 测试 1: 数据库 _transfer_sum 列 ---');

    // 动态导入 pool（ESM）
    const { default: pool } = await import('../config/db.js');

    for (const table of ['spatial_county_yunnan_transfer', 'spatial_grid_yunnan_transfer']) {
        try {
            const res = await pool.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema='public' AND table_name=$1 AND column_name='_transfer_sum'
            `, [table]);

            if (res.rows.length > 0) {
                ok(`${table} 存在 _transfer_sum 列`);

                // 检查是否有非零值
                const valRes = await pool.query(`
                    SELECT count(*) as cnt, min(_transfer_sum) as min_val, max(_transfer_sum) as max_val 
                    FROM public."${table}" WHERE _transfer_sum > 0
                `);
                const { cnt, min_val, max_val } = valRes.rows[0];
                if (parseInt(cnt) > 0) {
                    ok(`  非零行数: ${cnt}, 范围: ${min_val} - ${max_val} km²`);
                } else {
                    warn(`  _transfer_sum 全为 0！请先调用一次 breaks API (mode=transfer) 来填充数据`);
                }
            } else {
                fail(`${table} 缺少 _transfer_sum 列！请先调用一次 breaks API (mode=transfer)`);
            }
        } catch (err) {
            fail(`查询 ${table} 出错: ${err.message}`);
        }
    }

    await pool.end();
}

async function testGeoServerLayer(layerName) {
    info(`--- 测试 GeoServer 图层: ${layerName} ---`);

    // 1. 检查图层是否存在 (REST API)
    try {
        const url = `${BASE}/rest/layers/${WORKSPACE}:${layerName}.json`;
        const res = await fetch(url, {
            headers: { 'Authorization': 'Basic ' + Buffer.from('admin:geoserver').toString('base64') }
        });

        if (res.ok) {
            const data = await res.json();
            ok(`图层 ${layerName} 已发布`);
            info(`  默认样式: ${data.layer?.defaultStyle?.name || '未设置'}`);
        } else if (res.status === 404) {
            fail(`图层 ${layerName} 未在 GeoServer 中发布！`);
            info(`  请在 GeoServer 管理界面 → Layers → Add new layer → 选择 PostGIS Store → 发布 ${layerName}`);
            return false;
        } else {
            warn(`检查图层状态返回 ${res.status} (可能是认证问题，不影响 WMS)`);
        }
    } catch (err) {
        warn(`无法访问 GeoServer REST API: ${err.message} (不影响 WMS 测试)`);
    }

    // 2. 测试 WMS GetCapabilities
    try {
        const capsUrl = `${BASE}/${WORKSPACE}/wms?service=WMS&version=1.1.0&request=GetCapabilities`;
        const res = await fetch(capsUrl);
        const text = await res.text();

        if (text.includes(layerName)) {
            ok(`WMS GetCapabilities 中包含 ${layerName}`);
        } else {
            fail(`WMS GetCapabilities 中未找到 ${layerName}！图层未正确发布`);
            return false;
        }
    } catch (err) {
        fail(`GetCapabilities 请求失败: ${err.message}`);
        return false;
    }

    // 3. 测试 WMS GetMap（无 env 参数，用默认样式）
    try {
        const mapUrl = `${BASE}/${WORKSPACE}/wms?service=WMS&version=1.1.0&request=GetMap` +
            `&layers=${WORKSPACE}:${layerName}&styles=&format=image/png&transparent=true` +
            `&width=256&height=256&srs=EPSG:4326&bbox=97.5,21.1,106.2,29.3`;

        const res = await fetch(mapUrl);
        const contentType = res.headers.get('content-type');

        if (contentType?.includes('image/png')) {
            ok(`WMS GetMap 成功（默认样式），返回 PNG 图片，大小: ${res.headers.get('content-length')} bytes`);
        } else {
            const text = await res.text();
            fail(`WMS GetMap 返回错误 (${contentType}):`);
            // 提取关键错误信息
            const match = text.match(/<ServiceException[^>]*>([\s\S]*?)<\/ServiceException>/);
            if (match) {
                console.log(`  ${RED}GeoServer 错误: ${match[1].trim()}${RESET}`);
            } else {
                console.log(`  ${text.substring(0, 500)}`);
            }
            return false;
        }
    } catch (err) {
        fail(`WMS GetMap 请求失败: ${err.message}`);
        return false;
    }

    // 4. 测试 WMS GetMap（带 transfer_dynamic 样式 + env 参数）
    try {
        const envParams = 'attr:_transfer_sum;th1:5;th2:10;th3:20;th4:30;th5:50;th6:80;th7:120;th8:200;th9:400';
        const mapUrl = `${BASE}/${WORKSPACE}/wms?service=WMS&version=1.1.0&request=GetMap` +
            `&layers=${WORKSPACE}:${layerName}&styles=transfer_dynamic&format=image/png&transparent=true` +
            `&width=256&height=256&srs=EPSG:4326&bbox=97.5,21.1,106.2,29.3` +
            `&env=${encodeURIComponent(envParams)}`;

        info(`  测试 URL: ${mapUrl}`);

        const res = await fetch(mapUrl);
        const contentType = res.headers.get('content-type');

        if (contentType?.includes('image/png')) {
            ok(`WMS GetMap 成功（transfer_dynamic 样式 + env），大小: ${res.headers.get('content-length')} bytes`);
        } else {
            const text = await res.text();
            fail(`WMS GetMap + transfer_dynamic 样式返回错误:`);
            const match = text.match(/<ServiceException[^>]*>([\s\S]*?)<\/ServiceException>/);
            if (match) {
                console.log(`  ${RED}GeoServer 错误: ${match[1].trim()}${RESET}`);
            } else {
                console.log(`  ${text.substring(0, 500)}`);
            }
            return false;
        }
    } catch (err) {
        fail(`WMS GetMap + env 请求失败: ${err.message}`);
        return false;
    }

    return true;
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  GeoServer 转移表 WMS 测试');
    console.log('='.repeat(60) + '\n');

    // 测试数据库
    await testDB();

    console.log('');

    // 测试两个图层
    const result1 = await testGeoServerLayer('spatial_county_yunnan_transfer');
    console.log('');
    const result2 = await testGeoServerLayer('spatial_grid_yunnan_transfer');

    console.log('\n' + '='.repeat(60));
    if (result1 && result2) {
        ok('所有测试通过！GeoServer WMS 服务正常');
    } else {
        fail('部分测试失败，请根据上述提示修复');
    }
    console.log('='.repeat(60) + '\n');

    process.exit(0);
}

main().catch(err => {
    fail(`测试脚本出错: ${err.message}`);
    process.exit(1);
});
