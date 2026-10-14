# Felipe Almeida Developer

Portfólio profissional multilíngue com site público, painel administrativo, projetos, artigos, notícias, contato, newsletter, SEO, LGPD, observabilidade e processamento assíncrono.

O código está organizado como monorepo e possui ambientes locais e imagens de produção reproduzíveis. A publicação em um provedor externo depende somente da configuração das credenciais e URLs daquele ambiente.

## Stack

| Camada         | Tecnologia                                                |
| -------------- | --------------------------------------------------------- |
| Web            | Next.js 15, React 19, TypeScript, Tailwind e `next-intl`  |
| API            | NestJS 11 em monólito modular com DDD/Clean Architecture  |
| Worker         | Node.js, outbox transacional e consumidores idempotentes  |
| Dados          | PostgreSQL 16 e Prisma 6                                  |
| Cache e sessão | Redis 7                                                   |
| Mensageria     | RabbitMQ 3.13 com retry e DLQ                             |
| Qualidade      | Jest, Vitest, Playwright, axe, Supertest e Testcontainers |
| Engenharia     | pnpm workspaces, Turborepo, Docker e GitHub Actions       |

Idiomas públicos: `pt-BR` (padrão), `en` e `es`.

## Pré-requisitos

- Node.js 20.11 ou superior;
- pnpm 9.12 via Corepack;
- Docker Desktop ou Docker Engine com Compose v2.

## Configuração local

No PowerShell:

```powershell
corepack enable
corepack prepare pnpm@9.12.0 --activate
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:setup
pnpm dev
```

No macOS, Linux ou Git Bash, troque `Copy-Item` por `cp`.

Serviços locais:

- site: `http://localhost:3000/pt-BR`;
- API: `http://localhost:3333/api`;
- health da API: `http://localhost:3333/api/health`;
- dependências: `http://localhost:3333/api/health/dependencies`;
- Swagger: `http://localhost:3333/docs`;
- RabbitMQ Management: `http://localhost:15672`;
- Mailpit: `http://localhost:8025`.

O `.env.example` usa somente valores de desenvolvimento e marcadores seguros. Antes de produção, substitua todos os segredos, endereços e campos `TODO`; a aplicação rejeita configurações inseguras críticas quando `NODE_ENV=production`.

## Banco e migrations

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:check
```

As migrations são append-only. O serviço `api` da imagem de produção executa `prisma migrate deploy` antes de iniciar e falha de forma explícita se a migração não puder ser aplicada.

## Publicação e agendamento

Artigos e notícias ficam públicos somente quando todas as condições são verdadeiras:

```text
publicationStatus = PUBLISHED
publishedAt <= agora
scheduledAt é nulo ou scheduledAt <= agora
```

`publishedAt` é a data editorial; `scheduledAt` é a retenção opcional até um instante futuro. O painel trabalha com o horário local do navegador e converte para ISO/UTC ao enviar. Listas, detalhes e capas consultam a mesma regra no PostgreSQL. Essas consultas temporais não dependem de cache, timer em memória, RabbitMQ ou reinício de processo.

O worker complementa o fluxo emitindo uma única vez os eventos vencidos de artigo e edição da newsletter. O marcador durável no banco e os locks transacionais evitam republicação concorrente.

## Mídia

Uploads administrativos validam extensão, MIME, assinatura real, tamanho e checksum. Imagens são decodificadas, limitadas por pixels e regravadas sem metadados; PDFs ativos são recusados. ClamAV é obrigatório em produção.

Desenvolvimento pode usar `MEDIA_STORAGE_PROVIDER=local`. Produção exige armazenamento S3-compatible privado, HTTPS, criptografia, versionamento e expiração de versões antigas. A reconciliação idempotente de exclusões pendentes está disponível ao superadministrador em `POST /api/admin/media/reconcile-storage`.

## Testes e quality gates

```bash
pnpm sdd:check
pnpm github:check
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:e2e
pnpm audit:prod
pnpm audit:all
git diff --check
```

Na primeira execução do E2E web:

```bash
pnpm --filter @fad/web exec playwright install chromium
```

Os testes de integração usam containers descartáveis. O CI também aplica todas as migrations em PostgreSQL limpo e constrói as três imagens de produção.

## Imagens e Compose de produção

Validar a configuração e construir as imagens:

```bash
pnpm infra:prod:config
pnpm infra:prod:build
```

Subir a composição após configurar um `.env` de produção:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.prod.yml up -d
```

As imagens são multi-stage e executam Web, API e Worker como usuário sem privilégios. O Compose de produção não publica PostgreSQL, Redis, RabbitMQ ou ClamAV na rede do host e inclui health checks e reinício controlado.

## Backup e restauração

Backup local pelo container PostgreSQL:

```bash
pnpm db:backup
```

O arquivo inclui ambiente e timestamp UTC. Cada backup recebe checksum SHA-256 e pode ser criptografado com AES-256-GCM autenticado por `BACKUP_ENCRYPTION_PASSPHRASE`. A retenção é controlada por `BACKUP_RETENTION_DAYS`.

Restauração:

```bash
pnpm db:restore backups/fad_development_AAAAMMDDTHHMMSSZ.sql.gz
```

A restauração valida o checksum e a autenticação criptográfica, executa o SQL em transação única e exige a frase exata `RESTAURAR:<banco>`. O workflow `Backup de produção` roda diariamente, usa `BACKUP_DATABASE_URL` e publica apenas o backup criptografado e seu checksum como artefato privado. Configure também `BACKUP_ENCRYPTION_PASSPHRASE` com ao menos 32 caracteres.

Mídias de produção não são copiadas pelo script PostgreSQL: o bucket deve manter versionamento, criptografia e replicação/backup no provedor. Redis e RabbitMQ não armazenam a fonte primária de dados de negócio; filas duráveis e outbox permitem reconstrução operacional.

## Segurança e privacidade

- JWT de curta duração, refresh token rotativo em cookie `httpOnly`, CSRF e RBAC;
- CORS restrito, CSP, HSTS em produção e demais headers defensivos;
- rate limit e degradação controlada quando Redis fica indisponível;
- sanitização server-side de HTML rico;
- double opt-in, tokens armazenados por hash e links sensíveis no fragmento da URL;
- exportação, exclusão, anonimização e retenção de dados pessoais;
- logs estruturados com `correlationId`, sem tokens e corpos pessoais;
- CodeQL e auditoria de dependências no CI.

Auditoria de conteúdo legado:

```bash
pnpm security:audit-rich-text
```

A correção destrutiva só é liberada após backup e confirmações explícitas documentadas no próprio comando.

## Observabilidade

A API expõe health, readiness de dependências e métricas Prometheus autenticadas em produção. O worker expõe `/health/live`, `/health/ready` e `/metrics` na porta de gestão. Logs usam níveis estruturados e propagam `correlationId` por HTTP, outbox e eventos.

## CI/CD e Git Flow

Fluxo normal:

```text
feature|fix|chore|test|refactor|perf|ci/*
  -> pull request para develop
  -> pull request de develop para main
  -> release/deploy
```

Os merges em `develop` e `main` permanecem manuais e protegidos por checks. O CI valida lockfile, migrations, lint, tipos, testes, build, E2E, segurança e imagens. Após CI verde na `main`, o CD gera artefatos compilados e imagens Docker versionadas pelo commit. O envio a registry e o rollout dependem do provedor de hospedagem escolhido.

Workflows adicionais cobrem PR automático, hotfix/retrointegração, CodeQL, release SemVer e backup criptografado. Textos humanos, commits e releases permanecem em PT-BR.

## Encerrar o ambiente local

```bash
pnpm infra:down
```
