# Conventional Commits — Conduit Backend

Este repositório usa [Conventional Commits](https://www.conventionalcommits.org/).
**Issue antes de código** (§6 do GUIA-DE-REFATORACAO.md): toda alteração referencia
a issue com `#<id>`.

## Formato

```
<tipo>(<escopo>): <descrição curta> #<id>

[corpo opcional]

[rodapé opcional]
```

## Tipos

| Tipo | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento externo |
| `test` | Adição ou correção de testes |
| `chore` | Manutenção (deps, build, config) |
| `docs` | Documentação |
| `style` | Formatação, sem mudança lógica |
| `perf` | Melhoria de performance |
| `ci` | Mudanças em CI/CD |

## Escopos sugeridos

| Escopo | Domínio |
|--------|---------|
| `article` | Artigos e feed |
| `comment` | Comentários (extração do monólito — §4.2) |
| `favorite` | Favoritos (extração do monólito — §4.2) |
| `bookmark` | Bookmarks (nova feature — §4.5) |
| `auth` | Autenticação e JWT |
| `profile` | Perfis de usuário |
| `tag` | Tags |
| `ratelimit` | Rate limiting (§4.4) |
| `errors` | Tratamento de erros / asyncHandler (§4.3) |
| `types` | Tipagem TypeScript / strict (§4.1) |
| `prisma` | Schema e migrações |

## Exemplos

```
feat(bookmark): adicionar POST /api/articles/:slug/bookmark #42
refactor(article): extrair comment.service.ts do monólito #37
fix(auth): corrigir validação do header Authorization #31
chore(errors): adicionar asyncHandler nos controllers #29
test(ratelimit): testes de integração para 429 no login #44
docs: criar issue templates e Conventional Commits #1
```

## Regras

1. **Issue antes de código** — toda alteração tem uma issue aberta com `#<id>`.
2. **Corpo** obrigatório quando a decisão por trás da mudança não é óbvia.
3. **Rodapé** `BREAKING CHANGE:` apenas quando o contrato (§3) for alterado
   com permissão explícita via issue `needs-decision`.
4. **Nunca commitar** os itens de §13: `harness/`, `AGENTS.md`, `CLAUDE.md`,
   `docs/` (protegidos via `.git/info/exclude`).
