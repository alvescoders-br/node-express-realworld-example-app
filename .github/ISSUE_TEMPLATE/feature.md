---
name: Feature / Nova funcionalidade
about: Implementar ou expandir uma funcionalidade do projeto (§4/§5 do GUIA-DE-REFATORACAO.md)
title: "[feat] "
labels: feature
assignees: ''
---

## Descrição
<!-- O que será feito e por quê. Rastrear ao §4/§5 do GUIA-DE-REFATORACAO.md. -->

## DoR — Definition of Ready
- [ ] Escopo rastreável a §4/§5 do guia (citar a seção exata)
- [ ] Critérios de aceite definidos abaixo
- [ ] Invariantes de §3 a preservar listados abaixo
- [ ] Pontos de permissão de §14 resolvidos (ou marcado como N/A)
- [ ] Plano de teste definido abaixo
- [ ] Para mudanças de schema Prisma (§4.5): migração planejada e descrita

## Critérios de aceite
- [ ] ...

## Invariantes preservados (§3)
- [ ] Contrato da API RealWorld inalterado (rotas, envelopes, formato de erro)
- [ ] Arquitetura feature/camada inalterada (controller → service → Prisma)
- [ ] Estratégia de auth inalterada (express-jwt, esquema `Token`/`Bearer`)
- [ ] Outros: ...

## Plano de teste
<!-- unit / integração / contrato / E2E que cobrem os critérios de aceite -->
- [ ] Testes unitários: ...
- [ ] Testes de integração / contrato: ...

## DoD — Definition of Done
- [ ] Critérios de aceite atendidos sem mudança não autorizada
- [ ] Testes de contrato verdes (sem regressão de API)
- [ ] Testes de integração verdes (incluindo 429 para rate limit, se aplicável)
- [ ] Cobertura de mutação na meta (§11)
- [ ] Conventional Commits com `#<id>` nesta issue
- [ ] Prompts/skills registrados em `docs/` (§17)
