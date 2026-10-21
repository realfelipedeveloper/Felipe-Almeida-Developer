# SPEC 018 — Experiência visual imersiva

Status: **Concluído**

## Contexto

A primeira renovação organizou hierarquia, responsividade e consistência, mas a
experiência ainda transmite aparência de template estático. O portfólio precisa
de uma assinatura mais autoral, dinâmica e memorável, sem comprometer leitura,
performance ou acessibilidade.

## Objetivo

Transformar o site em uma experiência de estúdio digital cinematográfico, com
movimento orientado à narrativa, profundidade, interações responsivas ao cursor e
transições sutis entre páginas.

## Escopo

- camada ambiente animada e responsiva ao ponteiro;
- indicador de progresso de leitura;
- revelação progressiva de conteúdo durante o scroll;
- superfícies com profundidade e resposta tridimensional controlada;
- transição de entrada entre rotas;
- composição hero mais expressiva e faixa cinética com conteúdo administrável;
- refinamento visual de cards, seções editoriais e painel administrativo;
- fallback integral para `prefers-reduced-motion` e dispositivos touch.

## Fora de escopo

- alteração de contratos, banco, autenticação ou conteúdo persistido;
- introdução de conteúdo pessoal fixo no frontend;
- publicação ou configuração de produção.

## Critérios de aceite

- [x] CA-001 — A Home possui camada ambiente, movimento e profundidade visíveis,
  sem prejudicar leitura ou navegação.
- [x] CA-002 — Seções e cards usam revelação/tilt progressivos de forma consistente.
- [x] CA-003 — A experiência permanece funcional sem JavaScript de animação e com
  `prefers-reduced-motion`.
- [x] CA-004 — Não existe overflow horizontal em mobile.
- [x] CA-005 — Axe, E2E, lint, typecheck, testes e build permanecem verdes.

## Testes

- Playwright valida camada de experiência, elementos reveláveis e superfícies
  interativas;
- Playwright valida mobile, tema, idiomas e acessibilidade já existentes;
- quality gate completo do monorepo.

## Riscos e rollback

- Risco: animação excessiva ou custo de renderização. Mitigação: canvas com DPR
  limitado, baixa densidade, pausa em aba oculta, CSS compositado e redução de
  movimento nativa.
- Rollback: toda a mudança permanece isolada ao frontend, sem migração.

## Evidências de conclusão

- revisão visual local da Home em desktop e mobile, da página Sobre e do login
  administrativo, sem erro de console ou hidratação;
- 15 testes E2E do web aprovados, incluindo axe nos três idiomas, viewport mobile,
  ausência de overflow, camada imersiva e consentimento de analytics;
- 181 testes unitários e 16 testes E2E de API/worker aprovados;
- cobertura global da API em 81,29%;
- lint, typecheck e build aprovados, com 55 rotas web geradas;
- nenhuma publicação ou alteração de produção realizada.
