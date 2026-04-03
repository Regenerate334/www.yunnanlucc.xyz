import fs from 'fs';

const content = fs.readFileSync('c:/projects/webgis/my_webgis_project/src/views/Admin.vue', 'utf8');
const templateMatch = content.match(/<template>([\s\S]*)<\/template>/);
const template = templateMatch[1];

const lines = template.split('\n');
let stack = [];
lines.forEach((line, i) => {
    const rawTags = line.match(/<[a-zA-Z1-6-]+|<\/[a-zA-Z1-6-]+/g);
    if (!rawTags) return;

    rawTags.forEach(tag => {
        const tagName = tag.replace(/[<>/]/g, '').toLowerCase();
        if (['input', 'img', 'br', 'hr', 'link', 'meta', 'circle', 'path', 'ellipse', 'polyline', 'rect', 'line', 'stop', 'defs', 'lineargradient'].includes(tagName)) return;

        if (tag.startsWith('</')) {
            if (stack.length === 0) {
                console.log(`Line ${i + 2}: ERROR! Extra closer </${tagName}>`);
            } else {
                const last = stack.pop();
                if (last.name !== tagName) {
                    // console.log(`Line ${i + 2}: Mismatch! ${last.name} (from line ${last.line}) closed by </${tagName}>`);
                }
            }
        } else {
            stack.push({ name: tagName, line: i + 2 });
        }
    });
});

console.log(`Final stack: ${stack.map(s => `${s.name}(L${s.line})`).join(', ')}`);
