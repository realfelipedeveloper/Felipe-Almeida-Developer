#!/usr/bin/env node
const execPath = process.env.npm_execpath ?? '';
if (!execPath.toLowerCase().includes('pnpm')) {
  console.error('\nEste projeto usa pnpm. Execute: corepack enable && pnpm install\n');
  process.exit(1);
}
