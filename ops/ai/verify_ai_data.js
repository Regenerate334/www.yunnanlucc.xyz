import dataRouter from '../utils/dataRouter.js';
import registry from '../utils/dataSourceRegistry.js';
import '../utils/tools/clcdTool.js';
import '../utils/tools/transferTool.js';

async function test() {
    console.log('--- Testing DataRouter ---');
    const question = '昆明市2023年的土地利用情况';
    const ctx = { type: 'prefecture_pie', region: '昆明市' };
    const result = await dataRouter.route(question, ctx, 2023);
    console.log('Question:', question);
    // console.log('Result:', result.substring(0, 200) + '...');

    if (result.includes('昆明市')) {
        console.log('✅ Success: Found GIS data in context');
    } else {
        console.log('❌ Failure: No data retrieved');
    }

    console.log('\n--- Testing Plugin Matching ---');
    const transferQuestion = '请分析下土地流转情况';
    const transferResult = await dataRouter.route(transferQuestion, ctx, 2023);
    if (transferResult.includes('转移矩阵')) {
        console.log('✅ Success: Plugin correctly triggered');
    } else {
        console.log('❌ Failure: Plugin NOT triggered');
    }
}

test().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
