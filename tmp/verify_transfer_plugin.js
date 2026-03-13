
import registry from '../server/utils/dataSourceRegistry.js';
import '../server/utils/dataSources/transferSource.js'; // 确保插件已注册
import { EntityExtractor } from '../server/utils/dataRouter.js';

async function test() {
    const extractor = new EntityExtractor();
    const question = "为什么1985年到1990年云南耕地转入林地的区域主要集中在东北的几个县级市？";
    const entities = extractor.extract(question);

    console.log('提取的实体:', JSON.stringify(entities, null, 2));

    console.log('\n正在执行插件查询...');
    const startTime = Date.now();
    const resultContext = await registry.queryIfMatch(question, entities, 2023);
    const duration = Date.now() - startTime;

    console.log(`查询耗时: ${duration}ms`);
    console.log('\n--- AI 将看到的上下文 ---');
    console.log(resultContext);
    console.log('--------------------------');

    if (resultContext && resultContext.includes('1985-1990')) {
        console.log('\n✅ 测试通过：成功获取到 1985-1990 流转数据');
    } else {
        console.log('\n❌ 测试失败：未能获取正确数据');
    }

    process.exit(0);
}

test().catch(err => {
    console.error('测试异常:', err);
    process.exit(1);
});
