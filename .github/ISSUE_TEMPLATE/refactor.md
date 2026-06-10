---
name: Refactor / Refatoração
about: Melhorar estrutura interna sem alterar comportamento externo (§4.1/§4.2/§4.3)
title: "[refactor] "
labels: refactor
assignees: ''
---

## Descrição
<!-- O que será refatorado e por quê. Rastrear ao §4.1/§4.2/§4.3 do GUIA-DE-REFATORACAO.md. -->

## DoR — Definition of Ready
- [ ] Escopo rastreável a §4.1, §4.2 ou §4.3 do guia (citar a seção exata)
- [ ] Critérios de aceite definidos abaixo (comportamento externo preservado)
- [ ] Invariantes de §3 a preservar listados abaixo
- [ ] Pontos de permissão de §14 resolvidos (ou marcado como N/A)
- [ ] Testes de contrato existentes verdes no baseline (antes de começar)

## Critérios de aceite
- [ ] Comportamento externo idêntico (mesmas rotas, envelopes, status HTTP, erros)
- [ ] Testes verdes antes **e** depois da refatoração
- [ ] ...

## Invariantes preservados (§3)
- [ ] Contrato da API RealWorld inalterado
- [ ] Arquitetura feature/camada inalterada
- [ ] Estratégia de auth inalterada
- [ ] Singleton do PrismaClient preservado

## DoD — Definition of Done
- [ ] Critérios de aceite atendidos
- [ ] Testes de contrato verdes (sem regressão)
- [ ] Código mais legível/menor sem mudança de comportamento
- [ ] Conventional Commits com `#<id>` nesta issue
- [ ] Prompts/skills registrados em `docs/` (§17)
