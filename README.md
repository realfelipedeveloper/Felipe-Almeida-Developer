# Felipe Almeida Developer

Portfólio profissional com projetos, artigos, notícias, newsletter e contato — em **pt-BR, en e es**.

> Estado atual: fundação, PostgreSQL/Prisma, API modular, Redis, RabbitMQ, worker e **infraestrutura de engenharia GitHub/CI-CD** implementados. A antiga Parte 09 foi antecipada antes do frontend público para que as próximas entregas já passem por Git Flow e quality gates automatizados.

## Stack

| Camada | Tecnologia |
|---|---|
| Front | Next.js (App Router), React, TypeScript, Tailwind, next-intl |
| Back | NestJS (monólito modular, Clean Architecture/DDD) |
| Dados | PostgreSQL 16 + Prisma 6, Redis |
| Mensageria | RabbitMQ |
| Infra | Docker Compose, Turborepo, pnpm |
| Engenharia | Git Flow, GitHub Actions, CodeQL, CI/CD |
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

Para a execução local, os valores padrão do `.env.example` são suficientes para a infraestrutura. Antes de autenticação/deploy, os segredos deverão ser trocados.

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

## 3. Preparar o banco

Depois de `pnpm infra:up`:

```bash
pnpm db:setup
```

Para visualizar os dados:

```bash
pnpm db:studio
```

Health checks:

- API: http://localhost:3333/api/health
- Dependências: http://localhost:3333/api/health/dependencies
- Métricas Prometheus: http://localhost:3333/api/metrics

## 4. Rodar as aplicações

```bash
pnpm dev
```

O comando inicia:

- Web: http://localhost:3000/pt-BR
- API: http://localhost:3333/api
- Swagger: http://localhost:3333/docs
- Worker: outbox + consumidor RabbitMQ

### Endpoints públicos disponíveis

- `GET /api/profile?locale=pt-BR`
- `GET /api/projects?locale=pt-BR&page=1&limit=12`
- `GET /api/projects/:slug?locale=pt-BR`
- `GET /api/articles?locale=pt-BR&page=1&limit=12`
- `GET /api/articles/:slug?locale=pt-BR`
- `GET /api/news?locale=pt-BR&page=1&limit=12`
- `GET /api/news/:slug?locale=pt-BR`

## 5. Quality gates locais

```bash
pnpm sdd:check
pnpm github:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

O `sdd:check` é exclusivamente local porque os artefatos SDD/harness não são versionados.

## 6. Git Flow

Branches permanentes:

- `main`: último estado estável promovido;
- `develop`: integração das entregas.

Branches de trabalho:

- `feature/*`
- `fix/*`
- `hotfix/*`
- `chore/*`
- `docs/*`
- `test/*`
- `refactor/*`
- `perf/*`
- `ci/*`

Fluxo normal:

```text
branch de trabalho
        ↓
PR automático
     develop
        ↓
CI + merge manual
        ↓
PR automático
       main
        ↓
CI + merge manual
```

Hotfix:

```text
hotfix/*
   ↓
PR automático
 main
   ↓
merge manual
   ↓
retrointegração automática
   ↓
develop
```

Commits, títulos e descrições de PR devem permanecer em PT-BR, mantendo os tipos do Conventional Commits.

## 7. GitHub Actions / CI

O workflow `CI` executa:

- instalação com lockfile congelado;
- validação da política de PR;
- validação da configuração GitHub;
- Prisma Client;
- Prisma validate;
- lint;
- typecheck;
- testes;
- build.

O CI roda em `main`, `develop`, branches de trabalho e PRs para `main`/`develop`.

## 8. Pull requests automáticos

As automações abrem:

- branch de trabalho → `develop`;
- `develop` → `main`;
- `hotfix/*` → `main`.

O PR é aberto automaticamente, mas **o merge permanece manual**.

## 9. Segurança

O projeto executa CodeQL em:

- push para `main` e `develop`;
- PRs para `main` e `develop`;
- execução semanal.


## 10. Releases

O workflow `Release` é manual e exige SemVer:

```text
vX.Y.Z
```

Ele gera notas em PT-BR a partir dos commits, cria a tag e publica uma GitHub Release.

## 11. CD

Após um CI bem-sucedido na `main`, o workflow de entrega contínua:

1. recompila a versão validada;
2. gera um pacote dos artefatos de web, API e worker;
3. publica o artefato no GitHub Actions com retenção de 14 dias.

A implantação automática em infraestrutura externa será conectada quando o provedor de produção for definido. O pipeline de entrega já fica ativo sem simular um deploy que ainda não possui destino real.

## 12. Proteções recomendadas no GitHub

Após os workflows executarem ao menos uma vez:

- proteger `main` e `develop`;
- exigir PR antes do merge;
- exigir o check `Verificações obrigatórias`;
- bloquear force push;
- bloquear exclusão das branches permanentes;
- manter squash merge como estratégia de merge;
- não exigir aprovação externa enquanto o repositório tiver apenas um mantenedor.

Também é necessário habilitar em **Settings → Actions → General**:

- `Read and write permissions`;
- `Allow GitHub Actions to create and approve pull requests`.

## 13. Encerrar ambiente local

Pare `pnpm dev` com `Ctrl+C` e execute:

```bash
pnpm infra:down
```

## Próxima parte

A próxima etapa é a **Parte 05 — frontend público completo**, já desenvolvida sob os quality gates e automações de GitHub implantados nesta etapa.
