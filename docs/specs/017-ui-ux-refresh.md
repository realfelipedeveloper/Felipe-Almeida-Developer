# SPEC 017 — Renovação completa de UI/UX

Status: **Concluído**

## Contexto

O site público e o painel administrativo cumprem os fluxos funcionais, porém a
apresentação visual atual é excessivamente simples, com pouca hierarquia,
profundidade e identidade entre páginas.

## Objetivo

Entregar uma experiência visual moderna, elegante e coerente em todo o produto,
preservando contratos, conteúdo administrável, acessibilidade, responsividade e
os fluxos já implementados.

## Escopo

### Incluído

- sistema visual compartilhado com tokens de cor, superfície, tipografia, raio,
  sombra, espaçamento e movimento;
- navegação pública com estado ativo, menu responsivo e ações globais claras;
- nova composição para Home, Sobre, listagens, detalhes, formulários, páginas
  legais, estados vazios, carregamento, erro e 404;
- componentes editoriais e de projeto com mídia, hierarquia e interação refinadas;
- painel administrativo com navegação lateral, dashboard, autenticação,
  formulários, listas, modais e biblioteca de mídia visualmente consistentes;
- temas claro e escuro com contraste adequado;
- refinamento responsivo para mobile, tablet e desktop.

### Fora de escopo

- mudança de contratos da API ou modelo de dados;
- alteração do conteúdo editorial persistido;
- publicação ou configuração do ambiente de produção;
- troca das decisões arquiteturais existentes.

## Requisitos não funcionais

- RNF-001 — A interface deve manter navegação por teclado e foco visível.
- RNF-002 — Movimento deve respeitar `prefers-reduced-motion`.
- RNF-003 — Nenhuma viewport suportada pode apresentar rolagem horizontal.
- RNF-004 — O tema escuro permanece padrão e a preferência continua persistida.
- RNF-005 — A reformulação não pode introduzir dependência externa de runtime
  para fontes, ícones ou assets críticos.

## Testes

- Playwright nos três idiomas;
- axe nas homes localizadas;
- navegação desktop e mobile;
- persistência de tema;
- hierarquia e regiões principais da nova composição;
- ausência de overflow horizontal em mobile;
- lint, typecheck, testes existentes e build de produção.

## Critérios de aceite

- [x] CA-001 — Home e Sobre possuem composição editorial distinta, responsiva e
  orientada ao conteúdo.
- [x] CA-002 — Listagens, detalhes, formulários e páginas legais compartilham o
  mesmo sistema visual.
- [x] CA-003 — O painel administrativo possui navegação e superfícies adequadas a
  uma ferramenta de gestão, sem regressão funcional.
- [x] CA-004 — Temas claro/escuro, navegação mobile e idiomas continuam operantes.
- [x] CA-005 — Testes de acessibilidade não apresentam violações automáticas.
- [x] CA-006 — Quality gates relevantes ficam verdes.

## Evidências de conclusão

- sistema visual aplicado ao site público e ao painel administrativo, sem mudança
  de contratos ou dados;
- inspeção visual local em desktop e mobile nas páginas Home, Sobre, Projetos,
  Contato, login e superfícies administrativas;
- Playwright: 14 cenários aprovados, incluindo três idiomas, axe, tema, menu
  mobile, consentimento e ausência de overflow horizontal;
- suíte completa: lint, typecheck, 181 testes unitários, 7 testes operacionais,
  21 E2E da API, 14 E2E do web e 9 E2E do worker aprovados;
- cobertura global da API em 81,29% e build das 55 rotas do web aprovado.

## Riscos e rollback

- Risco principal: regressão de contraste ou responsividade ao substituir estilos
  dispersos. Mitigação: tokens centralizados, E2E, axe e inspeção visual em
  múltiplas viewports.
- Rollback: a mudança é isolada ao web e pode ser revertida sem migração de dados.
