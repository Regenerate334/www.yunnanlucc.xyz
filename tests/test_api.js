async function testApi() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'password' })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', loginRes.status);
            // Try admin123 if password fails
            const loginRes2 = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'admin123' })
            });
            if (!loginRes2.ok) {
                console.error('Login failed with admin123:', loginRes2.status);
                return;
            }
            const loginData = await loginRes2.json();
            var token = loginData.token;
            console.log('Login successful with admin123');
        } else {
            const loginData = await loginRes.json();
            var token = loginData.token;
            console.log('Login successful with password');
        }

        // 2. Test Hierarchy
        console.log('Fetching hierarchy...');
        const hierRes = await fetch('http://localhost:3000/api/regions/hierarchy', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!hierRes.ok) {
            console.error('Hierarchy fetch failed:', hierRes.status);
            const text = await hierRes.text();
            console.error(text);
            return;
        }

        const hierarchy = await hierRes.json();
        console.log('Hierarchy data received. Length:', hierarchy.length);
        if (hierarchy.length > 0) {
            console.log('First item:', JSON.stringify(hierarchy[0], null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

testApi();
