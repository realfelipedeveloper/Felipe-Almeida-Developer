#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
if (!fs.existsSync(path.join(root, '.git'))) {
  console.log('Husky: instalação adiada porque este ZIP ainda não é um repositório Git.');
  process.exit(0);
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(pnpm, ['exec', 'husky'], { stdio: 'inherit', shell: false });
process.exit(result.status ?? 0);
