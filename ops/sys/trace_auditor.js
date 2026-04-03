import fs from 'fs';

const content = fs.readFileSync('c:/projects/webgis/my_webgis_project/src/views/Admin.vue', 'utf8');
const template = content.split('<template>')[1].split('</template>')[0];

const lines = template.split('\n');
let stack = [];
lines.forEach((line, i) => {
    const tags = line.match(/<(div|main|aside|header|footer|nav|section|table|thead|tbody|tr|th|td|form|label|input|select|option|button|span|img|svg)|<\/(div|main|aside|header|footer|nav|section|table|thead|tbody|tr|th|td|form|label|input|select|option|button|span|img|svg)/g);

    if (tags) {
        tags.forEach(tag => {
            if (tag.startsWith('</')) {
                const closing = tag.slice(2);
                if (stack.length === 0) {
                    console.log(`Line ${i + 2}: ERROR! Extra closer ${tag}.`);
                } else {
                    stack.pop();
                    if (stack.length === 0) {
                        console.log(`Line ${i + 2}: ROOT CLOSED EARLY with ${tag}`);
                    }
                }
            } else {
                const opening = tag.slice(1);
                if (!['input', 'img', 'br', 'hr', 'line', 'polyline', 'rect', 'path', 'circle', 'ellipse', 'stop', 'meta', 'defs', 'linearGradient'].includes(opening)) {
                    stack.push(opening);
                }
            }
        });
    }
});
