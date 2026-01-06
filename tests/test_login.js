async function testLogin() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
        });
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Body:', data);
    } catch (err) {
        console.error('Error:', err);
    }
}

testLogin();
