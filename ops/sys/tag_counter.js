import fs from 'fs';

const content = fs.readFileSync('c:/projects/webgis/my_webgis_project/src/views/Admin.vue', 'utf8');
const template = content.split('<template>')[1].split('</template>')[0];

const openers = (template.match(/<div/g) || []).length;
const closers = (template.match(/<\/div>/g) || []).length;

console.log(`Openers: ${openers}`);
console.log(`Closers: ${closers}`);

// Find mismatch line
let balance = 0;
const lines = template.split('\n');
lines.forEach((line, i) => {
    const o = (line.match(/<div/g) || []).length;
    const c = (line.match(/<\/div>/g) || []).length;
    balance += (o - c);
    if (balance < 0) {
        console.log(`Line ${i + 2}: Balance below zero! (${balance})`);
        balance = 0; // Reset to find next
    }
});
console.log(`Final Balance: ${balance}`);
