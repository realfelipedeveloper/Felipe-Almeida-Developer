# Felipe Almeida Developer

Portfólio profissional com projetos, artigos, notícias, newsletter e contato — em **pt-BR, en e es**.

> Estado atual: fundação, PostgreSQL/Prisma, API modular, Redis, RabbitMQ, worker e **infraestrutura de engenharia GitHub/CI-CD** implementados. A antiga Parte 09 foi antecipada antes do frontend público para que as próximas entregas já passem por Git Flow e quality gates automatizados.

## Stack

| Camada     | Tecnologia                                                   |
| ---------- | ------------------------------------------------------------ |
| Front      | Next.js (App Router), React, TypeScript, Tailwind, next-intl |
| Back       | NestJS (monólito modular, Clean Architecture/DDD)            |
| Dados      | PostgreSQL 16 + Prisma 6, Redis                              |
| Mensageria | RabbitMQ                                                     |
| Infra      | Docker Compose, Turborepo, pnpm                              |
| Engenharia | Git Flow, GitHub Actions, CodeQL, CI/CD                      |
| Testes     | Jest, Vitest, Playwright, axe, Supertest e Testcontainers    |

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
pnpm test:e2e
```

Na primeira execução local do Playwright, instale o navegador gerenciado:

```bash
pnpm --filter @fad/web exec playwright install chromium
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
- testes unitários;
- build;
- Playwright/axe nos três idiomas;
- integrações com PostgreSQL e RabbitMQ via Testcontainers.

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

O CI também bloqueia vulnerabilidades moderadas ou superiores na árvore de
produção e vulnerabilidades críticas nas ferramentas de desenvolvimento:

```bash
pnpm audit:prod
pnpm audit:all
```

Overrides transitivos de segurança ficam declarados no `package.json` com
versões exatas. Eles existem apenas enquanto Next, Prisma e Nest Swagger não
publicarem árvores corrigidas e devem ser removidos após a atualização do
pacote pai. O override de `deepmerge-ts` atravessa uma versão major e exige
validar geração/validação do Prisma, migrações, banco, testes, build e worker.

Artigos e notícias usam sanitização server-side por allowlist antes da
persistência. Cada campo aceita no máximo 200 mil caracteres; o limite global
do corpo HTTP continua definido por `API_BODY_LIMIT`. Para auditar registros
anteriores sem imprimir o conteúdo:

```bash
pnpm security:audit-rich-text
```

Se houver divergências, gere e valide um backup antes da correção. A aplicação
é irreversível e exige confirmação explícita:

```bash
RICH_TEXT_BACKUP_CONFIRMED=true \
RICH_TEXT_SANITIZE_CONFIRM=SANITIZE_RICH_TEXT \
pnpm security:sanitize-rich-text
```

Uploads administrativos aceitam JPEG, PNG, WebP, GIF e PDF, com validação da
assinatura real, MIME, extensão, tamanho e checksum. Imagens são decodificadas,
limitadas por quantidade de pixels e regravadas sem metadados; PDFs com ações,
scripts, anexos ou formulários ativos são rejeitados. Em produção, o ClamAV é
obrigatório (`CLAMAV_HOST`) e precisa aceitar o protocolo `INSTREAM`.

Em desenvolvimento, os arquivos ficam em `MEDIA_LOCAL_ROOT`; em produção, a
API exige `MEDIA_STORAGE_PROVIDER=s3` e usa um bucket privado S3 ou provedor
compatível, via HTTPS e criptografia server-side. A biblioteca está em
`/admin/midia`. O endpoint público transmite apenas mídias ligadas a conteúdo
publicado ou ao perfil; rascunhos e arquivos órfãos permanecem acessíveis
somente no painel autenticado.

Mídias referenciadas não podem ser excluídas. A exclusão por superadministrador
cria primeiro um tombstone no banco e depois remove o objeto. Falhas ambíguas
permanecem pendentes e podem ser repetidas com segurança por
`POST /api/admin/media/reconcile-storage`. Em object storage, configure também
versionamento, regra de expiração para versões não atuais e bloqueio de acesso
público no bucket.

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
