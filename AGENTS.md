# Contribution instructions

This file is canonical. `CLAUDE.md` is a relative symlink to `AGENTS.md`.

Keep this repository small, portable and suitable for public distribution.
Write original public documentation. Do not copy private repository history,
internal instructions, client details, contracts, amounts, credentials,
private repository references or local machine paths into any tracked file.
Keep plans, logs and review evidence outside versioned content.

Use focused feature branches and pull requests. Preserve unrelated work.
Implement the authorized scope autonomously, with small functions and an
explicit I/O boundary when needed. Do not add runtime packages for work
covered by Node's standard library. Pin development dependencies and commit
the lockfile.

For tooling features, write failing behavior tests first. Exercise real rules
and parsers with mocked Git/filesystem capabilities and deterministic
synthetic data assembled in memory. Never exempt tests, scripts or lockfiles
from the leak policy. No literal credentials or sensitive paths in fixtures.

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and
`npm run check:leaks`. Stage intended new public files explicitly before the
leak gate; never stage private plans or evidence. Do not weaken checks,
ignore findings or bypass history to obtain success.

Follow [the publication policy](docs/PUBLICATION_POLICY.md). Automated
success must be paired with Francisco's or a reviewer's review of diff,
history, refs and metadata before the first public release. Report the
checks actually performed and any remaining limitation truthfully.
