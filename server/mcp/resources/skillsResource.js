/**
 * MCP Resource: GIS 专家技能库（skills）
 *
 * 说明：
 * - MCP 是 STDIO 协议服务，这里的 resource 用于把本地 skills 目录暴露给 MCP Host。
 * - skills 属于“知识资源”，统一放在 server/knowledge/skills。
 */

import fs from 'fs/promises';
import path from 'path';

const SKILLS_DIR = path.resolve('server/knowledge/skills');

export function registerSkillsResource(server) {
  server.resource(
    'gis-expert-skills',
    'mcp://gis/skills',
    async (uri) => {
      const files = await fs.readdir(SKILLS_DIR);
      let combinedContent = '# GIS 专家技能库综述\n\n';

      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = await fs.readFile(path.join(SKILLS_DIR, file), 'utf-8');
        combinedContent += `## ${file}\n${content}\n\n`;
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: combinedContent,
            mimeType: 'text/markdown'
          }
        ]
      };
    }
  );
}

