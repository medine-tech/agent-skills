# Agent Skills

A small home for portable agent skills, licensed under [MIT](LICENSE).

This foundation establishes contribution rules and publication checks. There
are no installable skills in this increment. The repository stays private
until its publication review is complete.

## Development

Use Node **24.19.0** and npm **12.0.2**. Runtime code uses Node's standard
library; TypeScript and Node types are pinned development tools.

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm run typecheck
npm run build
npm run check:leaks
```

Build emits JavaScript into the ignored `dist` directory. Tests use synthetic
in-memory Git and filesystem responses. Lint checks unused code and strict
types; typecheck independently checks the full source and test contracts.

Stage intended new files before running the leak gate: it reads the complete
index, its current worktree files, HEAD and all locally available refs and
reachable history. Deleting a leaked value from today's files does not remove
it from history. Run checks from the repository root without concurrent edits.

The gate emits JSON with exit code **0** for a complete clean inspection,
**1** for blocked content, or **2** for incomplete inspection. Diagnostics
contain rule names, scopes, opaque ordinals, valid text line numbers and totals. See the
[publication policy](docs/PUBLICATION_POLICY.md) for coverage, limits and how
to handle findings.

Automated patterns cannot identify every confidential business detail or
obfuscated credential. Before making the repository public, Francisco or a
reviewer must inspect the intended diff, full publication history, refs and
metadata, including authorship, and confirm the exact refs to publish.
