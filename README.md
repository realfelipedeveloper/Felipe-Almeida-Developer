# Felipe Almeida Developer

Portfólio profissional com projetos, artigos, notícias, newsletter e contato — em **pt-BR, en e es**.

> Estado atual: **Parte 3 concluída no código — fundação executável + SDD/harness + PostgreSQL/Prisma**. O site, a API e o worker sobem localmente; PostgreSQL, Redis, RabbitMQ e Mailpit estão definidos no Docker Compose. O repositório possui specs, ADRs, agentes, skills, PRE-TASK GATE, Adaptive Engineering Loop, schema Prisma, migração inicial, seed e portas de repositório de domínio.

## Stack

| Camada | Tecnologia |
|---|---|
| Front | Next.js (App Router), React, TypeScript, Tailwind, next-intl |
| Back | NestJS (monólito modular, Clean Architecture/DDD) |
| Dados | PostgreSQL 16 + Prisma 6, Redis |
| Mensageria | RabbitMQ |
| Infra | Docker Compose, Turborepo, pnpm |
| Testes | Jest (API), Vitest (web); Playwright/Testcontainers nas próximas partes |

## Pré-requisitos

- Node.js 20.11 ou superior
- pnpm 9
- Docker Desktop
- VSCode (recomendado)

No Windows, abra o Docker Desktop antes de subir a infraestrutura.

## 1. Preparar o projeto

### PowerShell (Windows)

```powershell
corepack enable
corepack prepare pnpm@9.12.0 --activate
Copy-Item .env.example .env
pnpm install
```

### macOS/Linux/Git Bash

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
cp .env.example .env
pnpm install
```

Para esta primeira execução, os valores padrão do `.env.example` são suficientes para a infraestrutura local. Antes de autenticação/deploy, os segredos deverão ser trocados.

## 2. Subir a infraestrutura

```bash
pnpm infra:up
```

Isso sobe:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- RabbitMQ: `localhost:5672`
- RabbitMQ Management: http://localhost:15672
- Mailpit SMTP: `localhost:1025`
- Mailpit UI: http://localhost:8025

Verifique os containers:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
```


## 3. Preparar o banco

Depois de `pnpm infra:up`, execute:

```bash
pnpm db:setup
```

Esse comando gera o Prisma Client, valida o schema, aplica a migração inicial, executa o seed e roda um smoke test.

Para visualizar os dados:

```bash
pnpm db:studio
```

Health específico do banco após iniciar a API:

- http://localhost:3333/api/health/database

## 4. Rodar as aplicações


Em outro terminal, na raiz:

```bash
pnpm dev
```

O comando inicia em paralelo:

- Web: http://localhost:3000/pt-BR
- API health: http://localhost:3333/api/health
- Swagger: http://localhost:3333/docs
- Worker: processo-base no terminal

A rota `/` redireciona para o idioma padrão (`/pt-BR`). Também existem `/en` e `/es`.

## 5. Validações úteis

Valide primeiro o harness SDD:

```bash
pnpm sdd:check
```

Depois rode os quality gates técnicos:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 6. Encerrar

Pare `pnpm dev` com `Ctrl+C` e depois:

```bash
pnpm infra:down
```

## Se alguma porta estiver ocupada

Antes de iniciar as aplicações:

```bash
pnpm check:ports --apps-only
```

Para receber sugestões de portas alternativas:

```bash
node infra/scripts/check-ports.mjs --suggest
```

Depois altere a porta correspondente no `.env`.

## Estrutura atual

```text
apps/
  web/       Next.js + i18n + tema + página inicial executável
  api/       NestJS + Swagger + Prisma + health checks
  worker/    processo-base dos futuros consumidores RabbitMQ
packages/
  config/    TypeScript compartilhado
  contracts/ tipos e contratos compartilhados
infra/
  docker/    PostgreSQL, Redis, RabbitMQ e Mailpit
  scripts/   portas, backup, restore e validações
apps/api/prisma/
  schema.prisma  modelo relacional
  migrations/    migrações versionadas
  seed.cjs       seed idempotente
docs/
  specs/     especificações SDD e critérios de aceite
  adr/       decisões de arquitetura
  arquitetura.md  visão arquitetural
  gitflow.md      fluxo de branches/PRs
  runbook.md      operação local
.agents/
  harness/   PRE-TASK GATE + Adaptive Engineering Loop
  skills/    skills reutilizáveis
  *.md       agentes especializados
AGENTS.md    regras operacionais do repositório
```

## SDD / Harness

Antes de qualquer implementação relevante, os agentes devem seguir `AGENTS.md`, identificar a spec e os ADRs relacionados e executar o PRE-TASK GATE. A estrutura pode ser validada com:

```bash
pnpm sdd:check
```

## Próxima parte planejada

**Parte 4 — API modular:** casos de uso e adapters Prisma, CRUD público/admin inicial, Redis, RabbitMQ, worker e logs estruturados.

## Primeiro push (quando você decidir publicar)

```bash
git init
git add .
git commit -m "chore: estrutura inicial executável"
git branch -M main
git remote add origin https://github.com/realfelipedeveloper/Felipe-Almeida-Developer.git
git push -u origin main
git checkout -b develop
git push -u origin develop
```
