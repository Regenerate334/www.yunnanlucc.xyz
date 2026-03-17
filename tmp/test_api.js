import fetch from 'node-fetch';

async function testApi() {
    const baseUrl = 'http://localhost:3000/api/clcd/breaks';
    const params = new URLSearchParams({
        mode: 'rate',
        attr: 'reclamation',
        year: '2023',
        unit: 'county',
        classes: '9',
        method: 'jenks'
    });

    try {
        console.log(`Testing URL: ${baseUrl}?${params.toString()}`);
        const response = await fetch(`${baseUrl}?${params.toString()}`, {
            headers: {
                // Mock authentication if needed, but here we assume Localhost bypass or we need token
                'Authorization': 'Bearer ' + 'YOUR_TOKEN_HERE' // This might fail if auth is enforced
            }
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch Error:', err.message);
    }
}

// Since I don't have a valid token easily, I'll try to run a local script that imports the router logic or bypasses auth in a test runner way.
// Better: Check the server logs or use a script that uses the pool directly to simulate the handler logic.
