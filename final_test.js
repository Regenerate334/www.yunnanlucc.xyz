async function testApi() {
    try {
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', loginRes.status);
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Login successful.');

        console.log('Fetching hierarchy...');
        const hierRes = await fetch('http://localhost:3000/api/regions/hierarchy', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!hierRes.ok) {
            console.error('Hierarchy fetch failed:', hierRes.status);
            return;
        }

        const hierarchy = await hierRes.json();
        console.log('Hierarchy data received. Count:', hierarchy.length);
        if (hierarchy.length > 0) {
            console.log('First item:', hierarchy[0].name, 'with', hierarchy[0].children.length, 'children');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testApi();
