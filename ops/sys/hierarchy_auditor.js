import fs from 'fs';

const content = fs.readFileSync('c:/projects/webgis/my_webgis_project/src/views/Admin.vue', 'utf8');
const template = content.split('<template>')[1].split('</template>')[0];

const lines = template.split('\n');
let stack = [];
lines.forEach((line, i) => {
    // Crude tag extractor
    const tags = line.match(/<(div|main|aside|header|footer|nav|section|table|thead|tbody|tr|th|td|form|label|input|select|option|button|span|img|svg|circle|path|ellipse|polyline|rect|line|defs|linearGradient|stop|textarea|small|p|h2|h3)|<\/(div|main|aside|header|footer|nav|section|table|thead|tbody|tr|th|td|form|label|input|select|option|button|span|img|svg|circle|path|ellipse|polyline|rect|line|defs|linearGradient|stop|textarea|small|p|h2|h3)/g);

    if (tags) {
        tags.forEach(tag => {
            if (tag.startsWith('</')) {
                const closing = tag.slice(2);
                if (stack.length === 0) {
                    console.log(`Line ${i + 2}: ERROR! Closing tag ${tag} with empty stack.`);
                } else {
                    const last = stack.pop();
                    if (last !== closing) {
                        // Some tags are self-closing in HTML but not strictly in XML/Vue
                        // But for simplicity just log it
                        if (!['input', 'img', 'line', 'polyline', 'rect', 'path', 'circle', 'ellipse', 'stop', 'meta'].includes(closing)) {
                            console.log(`Line ${i + 2}: Mismatch! Expected </${last}> but found ${tag}`);
                        }
                    }
                }
            } else {
                const opening = tag.slice(1);
                // Filter out self-closing tags if they don't have a separate close tag
                if (!['input', 'img', 'line', 'polyline', 'rect', 'path', 'circle', 'ellipse', 'stop', 'meta', 'br', 'hr', 'defs', 'linearGradient'].includes(opening)) {
                    stack.push(opening);
                }
            }
        });
    }
});

console.log(`Remaining stack: ${stack.join(', ')}`);
