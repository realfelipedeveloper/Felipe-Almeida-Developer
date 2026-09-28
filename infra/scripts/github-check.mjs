#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const obrigatorios = [
  '.github/workflows/ci.yml',
  '.github/workflows/auto-pr-develop.yml',
  '.github/workflows/auto-pr-main.yml',
  '.github/workflows/auto-pr-hotfix.yml',
  '.github/workflows/hotfix-retro-sync.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/release.yml',
  '.github/workflows/deploy.yml',
  '.github/CODEOWNERS',
];

const erros = [];

for (const relativo of obrigatorios) {
  const absoluto = path.join(root, relativo);
  if (!fs.existsSync(absoluto)) {
    erros.push(`Arquivo obrigatório ausente: ${relativo}`);
  }
}

const ler = (relativo) => fs.readFileSync(path.join(root, relativo), 'utf8');

if (fs.existsSync(path.join(root, '.github/workflows/ci.yml'))) {
  const ci = ler('.github/workflows/ci.yml');
  for (const trecho of [
    'pnpm install --frozen-lockfile',
    'pnpm db:validate',
    'pnpm typecheck',
    'pnpm test',
    'pnpm build',
    'Verificações obrigatórias',
  ]) {
    if (!ci.includes(trecho)) {
      erros.push(`CI não contém o requisito: ${trecho}`);
    }
  }
}

if (fs.existsSync(path.join(root, '.github/workflows/auto-pr-main.yml'))) {
  const fluxo = ler('.github/workflows/auto-pr-main.yml');
  if (!fluxo.includes('--base main') || !fluxo.includes('--head develop')) {
    erros.push('O PR automático develop → main não está configurado corretamente.');
  }
}

if (fs.existsSync(path.join(root, '.github/workflows/auto-pr-develop.yml'))) {
  const fluxo = ler('.github/workflows/auto-pr-develop.yml');
  if (!fluxo.includes('--base develop')) {
    erros.push('O PR automático de branches de trabalho → develop não está configurado.');
  }
}

if (fs.existsSync(path.join(root, '.github/workflows/auto-pr-hotfix.yml'))) {
  const fluxo = ler('.github/workflows/auto-pr-hotfix.yml');
  if (!fluxo.includes('--base main')) {
    erros.push('O PR automático de hotfix → main não está configurado.');
  }
}

if (fs.existsSync(path.join(root, '.github/workflows/deploy.yml'))) {
  const cd = ler('.github/workflows/deploy.yml');
  if (!cd.includes('workflow_run') || !cd.includes('actions/upload-artifact@v4')) {
    erros.push('O fluxo de entrega contínua não está ligado ao CI da main.');
  }
}

if (erros.length) {
  console.error('GitHub/CI-CD: FALHA');
  for (const erro of erros) console.error(`- ${erro}`);
  process.exit(1);
}

console.log('GitHub/CI-CD: OK');
console.log('- CI: instalado');
console.log('- PR automático para develop: instalado');
console.log('- Promoção automática develop → main: instalada');
console.log('- Hotfix e retrointegração: instalados');
console.log('- CodeQL: instalado');
console.log('- Release SemVer: instalada');
console.log('- CD com artefato de entrega: instalado');
