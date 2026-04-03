import fs from 'fs';

const content = fs.readFileSync('c:/projects/webgis/my_webgis_project/src/views/Admin.vue', 'utf8');
const templateMatch = content.match(/<template>([\s\S]*)<\/template>/);
if (!templateMatch) {
    console.log("No template found");
    process.exit(1);
}
const template = templateMatch[1];

const lines = template.split('\n');
let stack = [];
lines.forEach((line, i) => {
    // Only match div, main, aside, header, footer, etc.
    const tags = line.match(/<(div|main|aside|header|footer|nav|section|table|thead|tbody|tr|th|td|form|label|select|button|span|img|svg|h2|h3|p)|<\/(div|main|aside|header|footer|nav|section|table|thead|tbody|tr|th|td|form|label|select|button|span|img|svg|h2|h3|p)/g);

    if (tags) {
        tags.forEach(tag => {
            if (tag.startsWith('</')) {
                const closing = tag.slice(2);
                if (stack.length === 0) {
                    console.log(`Line ${i + 2}: ERROR! Extra closer ${tag}.`);
                } else {
                    const last = stack.pop();
                    if (last !== closing) {
                        // console.log(`Line ${i + 2}: Mismatch! ${last} vs ${closing}`);
                    }
                }
            } else {
                const opening = tag.slice(1);
                if (!['input', 'img', 'br'].includes(opening)) {
                    stack.push(opening);
                }
            }
        });
    }
});
console.log(`Final stack size: ${stack.length}`);
console.log(`Remaining tags: ${stack.join(', ')}`);
