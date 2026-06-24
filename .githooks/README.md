# Git hooks (versioned)

These hooks enforce the repository discipline from
`docs/GUIA-DE-REFATORACAO.md` (§6/§7) and `.github/COMMIT_CONVENTION.md`.

They are **not** active automatically — Git only runs hooks from
`.git/hooks/` unless `core.hooksPath` is pointed here. Activate once per clone:

```bash
git config core.hooksPath .githooks
```

## Hooks

- **commit-msg** — rejects any commit message that does not reference a GitHub
  issue id (`#<n>`). Merge / revert / fixup / squash commits are exempt.
  This closes the §5.2 gap where a commit could land without an issue link.
