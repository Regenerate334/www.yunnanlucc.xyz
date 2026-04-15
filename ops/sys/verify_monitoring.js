import landUseService from '../server/services/landUseService.js';
import logger from '../server/config/logger.js';

async function verify() {
    console.log('--- Monitoring Indices Verification ---');
    try {
        const year = 2023;
        const region = '云南省';
        const level = 'province';

        console.log(`Testing region: ${region}, year: ${year}...`);
        const data = await landUseService.getRegionMonitoring(year, region, level);

        if (!data) {
            console.error('FAILED: No data returned');
            process.exit(1);
        }

        console.log('SUCCESS: Data received');
        console.log('Composite Score:', data.compositeScore);
        console.log('Metrics:');
        console.log(JSON.stringify(data.metrics, null, 2));

        // Basic validation
        if (data.compositeScore < 0 || data.compositeScore > 100) {
            console.error('FAILED: Composite score out of range (0-100)');
        }

        for (const [key, metric] of Object.entries(data.metrics)) {
            if (typeof metric.value !== 'number' || typeof metric.score !== 'number') {
                console.error(`FAILED: Invalid metric for ${key}`);
            }
        }

        console.log('Verification finished.');
    } catch (err) {
        console.error('Verification ERROR:', err);
    } finally {
        process.exit(0);
    }
}

verify();
