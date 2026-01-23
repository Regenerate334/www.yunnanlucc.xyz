import { DataRouter } from './server/utils/dataRouter.js';

async function testRouter() {
    const router = new DataRouter();

    console.log('--- 测试 1: 省级趋势分析 (大尺度) ---');
    const context1 = await router.route('分析云南省近40年的耕地变化趋势', { type: 'province_trend' }, 2023);
    console.log(context1);

    console.log('\n--- 测试 2: 昆明市分析 (小尺度) ---');
    const context2 = await router.route('分析昆明市的土地利用结构', null, 2023);
    console.log(context2);

    process.exit(0);
}

testRouter().catch(err => {
    console.error(err);
    process.exit(1);
});
