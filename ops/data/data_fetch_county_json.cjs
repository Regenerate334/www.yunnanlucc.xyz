/**
 * ================================================================================
 * @File    :   data_fetch_county_json.cjs
 * @Desc    :   从阿里云 DataV GeoAtlas 批量抓取云南省 16 个地级行政区的县级 
 *              GeoJSON 边界数据，合并输出为 yunnan_all_counties.geojson。
 * @Usage   :   node ops/data/data_fetch_county_json.cjs
 * @Deps    :   fs, https, path (Node.js 内置)
 * ================================================================================
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

// Prefectures of Yunnan (from 530000_full)
const prefectures = [
    { name: "昆明市", adcode: 530100 },
    { name: "曲靖市", adcode: 530300 },
    { name: "玉溪市", adcode: 530400 },
    { name: "保山市", adcode: 530500 },
    { name: "昭通市", adcode: 530600 },
    { name: "丽江市", adcode: 530700 },
    { name: "普洱市", adcode: 530800 },
    { name: "临沧市", adcode: 530900 },
    { name: "楚雄彝族自治州", adcode: 532300 },
    { name: "红河哈尼族彝族自治州", adcode: 532500 },
    { name: "文山壮族苗族自治州", adcode: 532600 },
    { name: "西双版纳傣族自治州", adcode: 532800 },
    { name: "大理白族自治州", adcode: 532900 },
    { name: "德宏傣族景颇族自治州", adcode: 533100 },
    { name: "怒江傈僳族自治州", adcode: 533300 },
    { name: "迪庆藏族自治州", adcode: 533400 }
];

const outputDir = path.join(__dirname, '../../public/data');
const outputFile = path.join(outputDir, 'yunnan_all_counties.geojson');

async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error(`Error parsing JSON from ${url}:`, e);
                    reject(e);
                }
            });
        }).on('error', (e) => reject(e));
    });
}

async function main() {
    console.log('Starting data fetch for Yunnan counties...');
    const allFeatures = [];

    for (const pref of prefectures) {
        // Fetch sub-areas (districts/counties) for each prefecture
        const url = `https://geo.datav.aliyun.com/areas_v3/bound/${pref.adcode}_full.json`;
        console.log(`Fetching ${pref.name} (${pref.adcode}) from ${url}...`);

        try {
            const data = await fetchJson(url);
            if (data && data.features) {
                // Filter only Features that are actual sub-regions (not the parent itself if it exists, though _full usually has children)
                // Actually Datav _full contains children.
                // We add them to our collection.
                // We also might want to add a property indicating which prefecture they belong to if not present.
                data.features.forEach(f => {
                    if (!f.properties.parent) f.properties.parent = {};
                    f.properties.parent.name = pref.name;
                    f.properties.parent.adcode = pref.adcode;
                    allFeatures.push(f);
                });
                console.log(`  Added ${data.features.length} features.`);
            }
        } catch (e) {
            console.error(`  Failed to fetch ${pref.name}:`, e.message);
        }

        // Politeness delay
        await new Promise(r => setTimeout(r, 200));
    }

    const featureCollection = {
        type: "FeatureCollection",
        features: allFeatures
    };

    fs.writeFileSync(outputFile, JSON.stringify(featureCollection));
    console.log(`Successfully wrote ${allFeatures.length} counties to ${outputFile}`);
}

main();
