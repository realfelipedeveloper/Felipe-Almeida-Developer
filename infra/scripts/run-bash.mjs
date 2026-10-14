#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [, , script, ...args] = process.argv;
if (!script) {
  console.error('Informe o script Bash que deve ser executado.');
  process.exit(1);
}

const windowsCandidates = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
];
const executable =
  process.platform === 'win32'
    ? windowsCandidates.find((candidate) => existsSync(candidate))
    : 'bash';

if (!executable) {
  console.error('Git Bash não foi encontrado. Instale o Git for Windows para continuar.');
  process.exit(1);
}

const result = spawnSync(executable, [script, ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(`Não foi possível executar ${script}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
