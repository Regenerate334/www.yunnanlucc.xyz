import bcrypt from 'bcryptjs';

const hash = '$2b$10$PQNCfMVoijFPqttWMg.U1qWSOc9Hn6PXwp9o'; // From DB
const passwords = ['admin123', 'password', '123456', 'admin'];

async function test() {
    for (const p of passwords) {
        const match = await bcrypt.compare(p, hash);
        console.log(`Password "${p}" matches: ${match}`);
    }
}

test();
