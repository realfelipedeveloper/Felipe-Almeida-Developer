import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const requiredFiles = [
  'AGENTS.md',
  '.agents/README.md',
  '.agents/orquestrador.md',
  '.agents/arquiteto.md',
  '.agents/backend.md',
  '.agents/frontend.md',
  '.agents/qa.md',
  '.agents/seguranca.md',
  '.agents/devops.md',
  '.agents/revisor.md',
  '.agents/documentacao.md',
  '.agents/harness/PRE_TASK_GATE.md',
  '.agents/harness/ENGINEERING_LOOP.md',
  '.agents/harness/config.json',
  'docs/arquitetura.md',
  'docs/gitflow.md',
  'docs/runbook.md',
  'docs/specs/README.md',
  'docs/specs/_template.md',
  'docs/adr/README.md',
  'docs/adr/_template.md'
];

const requiredSkills = [
  'abrir-pr-ptbr',
  'criar-endpoint',
  'criar-migracao',
  'criar-modulo-ddd',
  'criar-pagina-i18n',
  'escrever-spec',
  'escrever-testes',
  'revisar-seguranca'
];

const errors = [];

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

for (const file of requiredFiles) {
  if (!(await exists(file))) errors.push(`Arquivo obrigatório ausente: ${file}`);
}

for (const skill of requiredSkills) {
  const file = `.agents/skills/${skill}/SKILL.md`;
  if (!(await exists(file))) errors.push(`Skill obrigatória ausente: ${file}`);
}

const specDir = path.join(root, 'docs/specs');
const adrDir = path.join(root, 'docs/adr');

try {
  const specs = (await readdir(specDir)).filter((name) => /^\d{3}-.+\.md$/.test(name));
  if (specs.length < 10) errors.push(`Specs insuficientes: encontradas ${specs.length}, esperado >= 10.`);
  for (const spec of specs) {
    const content = await readFile(path.join(specDir, spec), 'utf8');
    if (!/^# SPEC \d{3} — /m.test(content)) errors.push(`Cabeçalho inválido na spec: ${spec}`);
    if (!/Status: \*\*/.test(content)) errors.push(`Status ausente na spec: ${spec}`);
    if (!/## Critérios de aceite/.test(content)) errors.push(`Critérios de aceite ausentes na spec: ${spec}`);
  }
} catch (error) {
  errors.push(`Falha ao validar specs: ${error.message}`);
}

try {
  const adrs = (await readdir(adrDir)).filter((name) => /^\d{3}-.+\.md$/.test(name));
  if (adrs.length < 8) errors.push(`ADRs insuficientes: encontrados ${adrs.length}, esperado >= 8.`);
  for (const adr of adrs) {
    const content = await readFile(path.join(adrDir, adr), 'utf8');
    if (!/^# ADR \d{3} — /m.test(content)) errors.push(`Cabeçalho inválido no ADR: ${adr}`);
    if (!/Status: \*\*/.test(content)) errors.push(`Status ausente no ADR: ${adr}`);
  }
} catch (error) {
  errors.push(`Falha ao validar ADRs: ${error.message}`);
}

try {
  const raw = await readFile(path.join(root, '.agents/harness/config.json'), 'utf8');
  const config = JSON.parse(raw);
  const expectedLocales = ['pt-BR', 'en', 'es'];
  if (config.defaultLocale !== 'pt-BR') errors.push('defaultLocale do harness deve ser pt-BR.');
  if (JSON.stringify(config.supportedLocales) !== JSON.stringify(expectedLocales)) {
    errors.push('supportedLocales do harness deve ser ["pt-BR", "en", "es"].');
  }
  if (config.pullRequestLanguage !== 'pt-BR') errors.push('Idioma de PR do harness deve ser pt-BR.');
} catch (error) {
  errors.push(`Config do harness inválida: ${error.message}`);
}

if (errors.length > 0) {
  console.error('\nSDD/Harness: FALHOU\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('SDD/Harness: OK');
console.log('- AGENTS.md e agentes: presentes');
console.log('- PRE-TASK GATE e Engineering Loop: presentes');
console.log('- Skills: presentes');
console.log('- Specs: estrutura válida');
console.log('- ADRs: estrutura válida');
console.log('- i18n/PR language do harness: válidos');
