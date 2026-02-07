const http = require('http');

async function testGridYear1985() {
    // Login first
    const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });

    const loginPromise = new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': loginData.length
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });

    const loginResult = await loginPromise;
    if (!loginResult.token) {
        console.error('Login failed');
        return;
    }

    // Test breaks API for grid mode year 1985
    const breaksPromise = new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/clcd/breaks?attr=forest&year=1985&unit=grid&method=quantile&classes=10',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${loginResult.token}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Status Code:', res.statusCode);
                resolve(JSON.parse(data));
            });
        });
        req.on('error', reject);
        req.end();
    });

    const result = await breaksPromise;
    console.log('\n=== Grid Mode Year 1985 Response ===');
    console.log(JSON.stringify(result, null, 2));

    if (result.unavailable) {
        console.log('\n✅ SUCCESS: API correctly returns unavailable flag with friendly message');
    } else {
        console.log('\n❌ ISSUE: API should return unavailable flag for grid 1985');
    }
}

testGridYear1985().catch(console.error);
