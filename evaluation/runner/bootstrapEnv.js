import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

if (!process.env.AI_USE_MCP_TOOLS) {
  process.env.AI_USE_MCP_TOOLS = 'true';
}

if (!process.env.MCP_STDIO_MODE) {
  process.env.MCP_STDIO_MODE = 'true';
}
