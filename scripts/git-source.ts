import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, readFile, readlink } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { LIMITS } from './leak-check.ts';
import type { Source, WorktreeFile } from './leak-check.ts';

function ioFailure(): never { throw new Error('incomplete-inspection'); }
function missing(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'; }

export async function createGitSource(cwd: string): Promise<Source> {
  const started = Date.now();
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const env = { ...environment, GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' };
  const git = (args: string[], input?: Buffer, allowEmptyConfig = false): Promise<Buffer> => new Promise((accept, reject) => {
    const remaining = LIMITS.elapsedMs - (Date.now() - started);
    if (remaining <= 0) { reject(new Error('incomplete-inspection')); return; }
    const child = execFile('git', ['--no-pager', ...args], { cwd, env, encoding: 'buffer', timeout: Math.min(10000, remaining), maxBuffer: LIMITS.totalBytes, windowsHide: true }, (error, stdout, stderr) => {
      if (error && !(allowEmptyConfig && 'code' in error && error.code === 1 && stdout.length === 0 && stderr.length === 0)) { reject(new Error('incomplete-inspection')); return; }
      accept(stdout);
    });
    child.stdin?.on('error', () => reject(new Error('incomplete-inspection')));
    child.stdin?.end(input);
  });
  const root = resolve((await git(['rev-parse', '--show-toplevel'])).toString('utf8').trimEnd());
  if (root !== resolve(cwd)) ioFailure();
  const gitDir = resolve(root, (await git(['rev-parse', '--git-common-dir'])).toString('utf8').trimEnd());
  async function readWorktree(path: string): Promise<WorktreeFile> {
    const target = resolve(root, path);
    if (!target.startsWith(root + sep)) ioFailure();
    let parent = dirname(target);
    while (parent !== root) {
      try {
        const stats = await lstat(parent);
        if (!stats.isDirectory() || stats.isSymbolicLink()) ioFailure();
      } catch (error) {
        if (missing(error)) return { kind: 'missing', content: Buffer.alloc(0), fingerprint: 'absent' };
        ioFailure();
      }
      parent = dirname(parent);
    }
    try {
      const before = await lstat(target, { bigint: true });
      const fingerprint = [before.dev, before.ino, before.mode, before.size, before.mtimeNs, before.ctimeNs].join(':');
      if (before.isSymbolicLink()) return { kind: 'symlink', content: await readlink(target, { encoding: 'buffer' }), fingerprint };
      if (!before.isFile()) return { kind: 'unsupported', content: Buffer.alloc(0), fingerprint };
      if (before.size > BigInt(LIMITS.objectBytes)) ioFailure();
      const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const opened = await file.stat({ bigint: true });
        if (opened.dev !== before.dev || opened.ino !== before.ino || !opened.isFile() || opened.size > BigInt(LIMITS.objectBytes)) ioFailure();
        const content = await file.readFile();
        const after = await file.stat({ bigint: true });
        if (after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs || BigInt(content.length) !== before.size) ioFailure();
        return { kind: 'file', content, fingerprint };
      } finally { await file.close(); }
    } catch (error) {
      if (missing(error)) return { kind: 'missing', content: Buffer.alloc(0), fingerprint: 'absent' };
      ioFailure();
    }
  }
  return {
    now: Date.now,
    git,
    worktree: readWorktree,
    async preflight() {
      const shallow = await git(['rev-parse', '--is-shallow-repository']);
      const config = await git(['config', '--null', '--get-regexp', '^(extensions\\.partialclone|remote\\..*\\.(promisor|partialclonefilter))$'], undefined, true);
      const replacements = await git(['for-each-ref', '--format=%(objectname) %(refname)', 'refs/replace/']);
      let grafts = false;
      try { grafts = (await readFile(join(gitDir, 'info', 'grafts'))).length > 0; }
      catch (error) { if (!missing(error)) ioFailure(); }
      return { shallow, config, replacements, grafts };
    },
  };
}
