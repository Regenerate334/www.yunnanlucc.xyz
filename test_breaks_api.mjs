// Test API with proper authentication
import fetch from 'node-fetch';

async function testBreaksAPI() {
    try {
        // First, login to get a token
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Logged in successfully');

        // Now test the breaks API for impervious 2023 grid
        const breakRes = await fetch(
            'http://localhost:3000/api/clcd/breaks?attr=impervious&year=2023&unit=grid&method=quantile&classes=10',
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!breakRes.ok) {
            console.error('Breaks API failed:', await breakRes.text());
            return;
        }

        const breakData = await breakRes.json();
        console.log('Breaks API Response for impervious 2023 grid:');
        console.log(JSON.stringify(breakData, null, 2));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testBreaksAPI();
