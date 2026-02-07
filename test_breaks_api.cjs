const http = require('http');

async function testBreaksAPI() {
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
    console.log('Login result:', loginResult.token ? 'SUCCESS' : 'FAILED');

    if (!loginResult.token) {
        console.error(loginResult);
        return;
    }

    // Test breaks API
    const breaksPromise = new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/clcd/breaks?attr=impervious&year=2023&unit=grid&method=quantile&classes=10',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${loginResult.token}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.end();
    });

    const breaksResult = await breaksPromise;
    console.log('\n=== Breaks API Response for impervious 2023 grid ===');
    console.log(JSON.stringify(breaksResult, null, 2));
}

testBreaksAPI().catch(console.error);
