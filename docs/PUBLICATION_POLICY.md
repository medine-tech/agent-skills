# Publication policy

Only original, public, portable material belongs here. Publication requires
both a complete clean automated inspection and a review by Francisco or a
reviewer of the exact content and refs intended for release.

## Blocked material

- Credentials in recognized provider formats, private keys, sensitive
  assignments with values, authenticated URLs and webhook addresses.
- Local machine paths, environment files, private plans and evidence.
- Unknown URLs or repository references in the supported formats. Public
  sources must be added deliberately to the exact allowlist after review.
- Client identities, commercial amounts, contracts, internal procedures and
  other confidential details, whether or not a pattern detects them.

The scanner has no exemptions for tests, documentation, scripts or lockfiles.
Synthetic dangerous examples must be assembled from harmless fragments in
memory. Bare environment variable names, empty assignments and variable
references are allowed; actual sensitive values are not.

The explicit public repository allowlist is in `scripts/leak-policy.ts`.
It matches complete owner/repository names on GitHub, including supported
HTTPS, protocol-relative, bare host, shorthand and SCP forms and workflow action references.
Approved documentation hosts and exact registry package paths are separate.
URL hostnames and repository names are case-normalized; percent encoding is
normalized up to three passes. Unknown hosts, repository suffixes, credentials,
ports, insecure protocols and unsupported URL forms fail the policy. This is
a bounded text detector, not a general decoder or a proof of confidentiality.

## Inspected surface

`npm run check:leaks` inspects HEAD and every locally available ref, including
remote-tracking refs and tags. It reads reachable commits and annotated tags
in full, including authorship and messages, all reachable blob contents and
all historical snapshot paths. Direct tree and blob tag targets are included.
Path checks are independent of blob deduplication.

The full index and current content at every indexed path are also inspected.
A missing worktree file does not exempt its indexed or historical version.
Stage new public files before checking. Ignored and untracked files are not
part of this surface; forcibly tracked private files are blocked.

Git must provide complete history: shallow, partial/promisor, replacement
objects and grafts are rejected. Missing objects, malformed responses,
unmerged index entries, unreadable files, changed inventories, unsupported
object types and exceeded limits produce incomplete inspection. Git runs
without a shell, text conversion, checkout filters or lazy object fetching.

Only UTF-8 text is supported. Invalid bytes, binary control characters, NUL,
LFS pointers, submodules and unsupported filesystem entries are blocked.
The only allowed symlink is root `CLAUDE.md`, whose exact stored target is
`AGENTS.md`; that target must be a regular file in the same snapshot.
The scanner reads link text without following it and rejects symlink parents.

Refs are compared before and after inspection, as are the index and worktree
contents. Do not modify the repository concurrently. Each object or worktree
file is limited to 2 MiB, inspected content and Git command output to 64 MiB,
and individual inventories to 10,000 entries. The overall time limit is
120 seconds and each Git command has at most 10 seconds. Limits fail closed;
no truncated result counts as clean.

Reflogs, dangling objects, untracked files and remote refs absent from the
local clone are not claimed as scanned. CI fetches full history and tags.
Before publication, fetch and verify the exact branches and tags intended
for release; review any external metadata separately. Ordinary contributor
names and email addresses are not automatically classified as credentials.

Protocol-relative references must start at a text token boundary. Within
complete PGP signature armor, canonical base64 payload and checksum lines
are encoded data for that reference matcher. Other credential rules, armor
headers, commit messages and all surrounding metadata remain inspected.
Malformed armor is not given this treatment. This recognizes syntax only;
the scanner does not verify a signature or certify its authenticity.

In the initial subject of a commit object only, the complete standard
`Merge pull request #N from owner/ref` syntax identifies an owner and branch.
After validating that syntax, the ambiguous attribution prefix is classified
for the shorthand repository rule. Every other detector reads the original
text, and nested references remain inspected. Headers, message bodies, tags,
files and ref names do not receive this context. Malformed subjects follow
the ordinary rules; the syntax does not establish authenticity.

## Results and remediation

Exit codes are stable: **0** means complete and clean, **1** means blocked
content, **2** means inspection could not complete. JSON diagnostics expose
only rule, scope, opaque ordinal, valid text line number and totals. They intentionally omit values,
paths, ref names, Git error text and stack traces. Line numbers refer to the
original text; non-text and multiline-only matches without a reliable line
locator omit that field. Use a private local review
to locate the item; never paste raw findings into public logs or comments.

For a credential, remove it from the candidate and every ref to publish and
rotate it through the provider's private process. Coordinate any necessary
history cleanup before proceeding. For an unapproved public source, verify
its public status and propose an exact allowlist change with regression tests.
Never add a broad exclusion or suppress an error. Re-run all checks after
remediation and on the final commit intended for publication.

## Review before publication

1. Inspect the entire diff and the full history of the intended refs.
2. Review authorship, commit/tag messages, ref names and external repository
   metadata for secrets or confidential business details.
3. Confirm all included examples are synthetic and every dependency or link
   is public and necessary; verify standalone use.
4. Confirm the local ref inventory matches the set to publish and all five
   checks pass on the final commit.
5. Record Francisco's or the reviewer's approval privately, then publish only
   the reviewed refs through the established pull request workflow.

Regex cannot reliably recognize arbitrary private names, commercial facts or
obfuscated data. The semantic review remains a required gate. Binary formats,
extra symlinks and submodules are deliberately unsupported in this repository.
