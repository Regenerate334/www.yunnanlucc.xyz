import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

async function test() {
    try {
        const response = await ollama.chat({
            model: 'deepseek-r1:1.5b',
            messages: [{ role: 'user', content: 'Why is the sky blue? Answer in 10 words or less.' }],
            stream: true,
        });

        for await (const part of response) {
            console.log(JSON.stringify(part.message));
        }
    } catch (e) {
        console.error(e);
    }
}

test();
