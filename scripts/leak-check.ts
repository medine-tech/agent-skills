import { decodeDocument, inspectContent, inspectPath, protocolReferenceText, shorthandReferenceText } from './leak-policy.ts';
import type { Rule } from './leak-policy.ts';

export const LIMITS = { objectBytes: 2 * 1024 * 1024, totalBytes: 64 * 1024 * 1024, items: 10000, elapsedMs: 120000 } as const;
export type WorktreeFile = { kind: 'file' | 'symlink' | 'missing' | 'unsupported'; content: Buffer; fingerprint: string };
export interface Source {
  now(): number;
  preflight(): Promise<{ shallow: Buffer; config: Buffer; replacements: Buffer; grafts: boolean }>;
  git(args: string[], input?: Buffer): Promise<Buffer>;
  worktree(path: string): Promise<WorktreeFile>;
}
type Scope = 'history' | 'index' | 'worktree' | 'metadata' | 'inspection';
export type Finding = { rule: Rule | 'incomplete-inspection'; scope: Scope; id: number; line?: number };
export type Result = { exitCode: 0 | 1 | 2; findings: Finding[]; inspected: number };
type Entry = { mode: string; oid: string; path: string };
type GitObject = { type: 'blob' | 'tree' | 'commit' | 'tag'; content: Buffer };
const isOid = (value: string) => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
function requireComplete(condition: unknown): asserts condition {
  if (!condition) throw new Error('incomplete-inspection');
}
function utf8(bytes: Buffer): string { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
function records(bytes: Buffer, separator: string): string[] {
  const text = utf8(bytes);
  if (!text) return [];
  requireComplete(text.endsWith(separator));
  const values = text.slice(0, -separator.length).split(separator);
  requireComplete(values.length <= LIMITS.items && values.every(Boolean));
  return values;
}
function validPath(path: string) {
  requireComplete(path && !path.startsWith('/') && !path.includes('\0') && !path.split('/').some(part => !part || part === '.' || part === '..'));
}
function parseEntries(bytes: Buffer, indexed: boolean): Entry[] {
  const entries = records(bytes, '\0').map(record => {
    const tab = record.indexOf('\t');
    requireComplete(tab > 0);
    const header = record.slice(0, tab).split(' ');
    const path = record.slice(tab + 1);
    validPath(path);
    const [mode, middle, last] = header;
    requireComplete(header.length === 3 && /^\d{6}$/.test(mode ?? ''));
    const oid = indexed ? middle : last;
    requireComplete(oid && isOid(oid));
    requireComplete(indexed ? last === '0' : (
      (middle === 'blob' && ['100644', '100755', '120000'].includes(mode!)) ||
      (middle === 'commit' && mode === '160000') || (middle === 'tree' && mode === '040000')
    ));
    return { mode: mode!, oid, path };
  });
  requireComplete(new Set(entries.map(entry => entry.path)).size === entries.length);
  return entries;
}
function parseBatch(bytes: Buffer, ids: string[]): Map<string, GitObject> {
  let cursor = 0;
  const objects = new Map<string, GitObject>();
  for (const expected of ids) {
    const end = bytes.indexOf(10, cursor);
    requireComplete(end >= 0);
    const header = utf8(bytes.subarray(cursor, end)).split(' ');
    const [id, type, length] = header;
    requireComplete(header.length === 3 && id === expected && ['blob', 'tree', 'commit', 'tag'].includes(type ?? '') && /^\d+$/.test(length ?? ''));
    const size = Number(length);
    requireComplete(Number.isSafeInteger(size) && size <= LIMITS.objectBytes);
    cursor = end + 1;
    requireComplete(cursor + size < bytes.length && bytes[cursor + size] === 10);
    objects.set(expected, { type: type as GitObject['type'], content: bytes.subarray(cursor, cursor + size) });
    cursor += size + 1;
  }
  requireComplete(cursor === bytes.length);
  return objects;
}
async function assertRepository(source: Source) {
  const state = await source.preflight();
  requireComplete(utf8(state.shallow) === 'false\n' && state.replacements.length === 0 && !state.grafts);
  requireComplete(state.config.length === 0);
}
async function inventory(source: Source) {
  const head = await source.git(['rev-parse', '--verify', 'HEAD']);
  requireComplete(isOid(utf8(head).trim()) && utf8(head) === `${utf8(head).trim()}\n`);
  const refs = await source.git(['for-each-ref', '--format=%(objectname) %(refname)']);
  const index = await source.git(['ls-files', '--stage', '-z']);
  const history = await source.git(['rev-list', '--objects', '--all', '--no-object-names', '--missing=error', 'HEAD']);
  return { head, refs, index, history };
}
function snapshotEqual(before: Awaited<ReturnType<typeof inventory>>, after: Awaited<ReturnType<typeof inventory>>) {
  return before.head.equals(after.head) && before.refs.equals(after.refs) && before.index.equals(after.index) && before.history.equals(after.history);
}

export async function checkLeaks(source: Source): Promise<Result> {
  const findings: Finding[] = [];
  let inspected = 0;
  let totalBytes = 0;
  const started = source.now();
  const checkTime = () => requireComplete(source.now() - started <= LIMITS.elapsedMs);
  const add = (rules: Finding['rule'][], scope: Scope, id: number, line?: number) => {
    for (const rule of rules) findings.push({ rule, scope, id, ...(line === undefined ? {} : { line }) });
  };
  const count = (bytes: Buffer) => {
    totalBytes += bytes.length;
    requireComplete(bytes.length <= LIMITS.objectBytes && totalBytes <= LIMITS.totalBytes && source.now() - started <= LIMITS.elapsedMs);
  };
  const scan = (bytes: Buffer, scope: Scope, id: number, kind: 'commit' | 'text' = 'text') => {
    count(bytes);
    const document = decodeDocument(bytes);
    checkTime();
    if (document === undefined) add(['uninspectable-content'], scope, id);
    else {
      const shorthandText = shorthandReferenceText(document, kind);
      const rules = inspectContent(document, undefined, shorthandText);
      checkTime();
      const locations = new Map<Rule, number>();
      if (rules.length) {
        const protocolLines = protocolReferenceText(document).split('\n');
        const shorthandLines = shorthandText.split('\n');
        for (const [offset, line] of document.split('\n').entries()) {
          checkTime();
          for (const rule of inspectContent(line, protocolLines[offset]!, shorthandLines[offset]!)) if (!locations.has(rule)) locations.set(rule, offset + 1);
          checkTime();
        }
      }
      for (const rule of rules) add([rule], scope, id, locations.get(rule));
    }
    checkTime();
    inspected++;
  };
  try {
    await assertRepository(source);
    const before = await inventory(source);
    const indexEntries = parseEntries(before.index, true);
    const refRecords = records(before.refs, '\n');
    const refIds = refRecords.map((record, id) => {
      const space = record.indexOf(' ');
      const objectId = record.slice(0, space);
      requireComplete(space > 0 && isOid(objectId) && /^refs\/[^\s]+$/.test(record.slice(space + 1)));
      scan(Buffer.from(record.slice(space + 1)), 'metadata', id + 1);
      return objectId;
    });
    const historyIds = records(before.history, '\n');
    requireComplete(historyIds.length > 0 && historyIds.every(isOid));
    const ids = [...new Set([...historyIds, utf8(before.head).trim(), ...refIds, ...indexEntries.filter(entry => entry.mode !== '160000').map(entry => entry.oid)])];
    requireComplete(ids.length <= LIMITS.items);
    const batch = await source.git(['cat-file', '--batch'], Buffer.from(ids.join('\n') + '\n'));
    requireComplete(batch.length <= LIMITS.totalBytes);
    const objects = parseBatch(batch, ids);
    const trees = new Set<string>();
    for (const [offset, id] of ids.entries()) {
      const object = objects.get(id)!;
      if (object.type === 'tree') continue;
      scan(object.content, historyIds.includes(id) ? (object.type === 'blob' ? 'history' : 'metadata') : 'index', offset + 1, object.type === 'commit' ? 'commit' : 'text');
      if (object.type === 'blob') continue;
      const document = decodeDocument(object.content);
      requireComplete(document !== undefined);
      const firstLine = document.split('\n')[0] ?? '';
      const target = firstLine.split(' ')[1];
      requireComplete(target && isOid(target) && objects.has(target));
      if (object.type === 'commit') {
        requireComplete(firstLine === `tree ${target}` && objects.get(target)?.type === 'tree' && document.includes('\n\n'));
        trees.add(target);
      } else {
        requireComplete(firstLine === `object ${target}` && document.includes(`\ntype ${objects.get(target)!.type}\n`) && document.includes('\n\n'));
        if (objects.get(target)?.type === 'tree') trees.add(target);
      }
    }
    // A ref may directly name a tree, without an annotated tag or commit.
    for (const id of refIds) if (objects.get(id)?.type === 'tree') trees.add(id);
    const inspectEntries = (entries: Entry[], scope: Scope) => {
      for (const [offset, entry] of entries.entries()) {
        const id = offset + 1;
        add(inspectPath(entry.path), scope, id);
        if (entry.mode === '040000') {
          requireComplete(scope === 'history' && objects.get(entry.oid)?.type === 'tree');
          continue;
        }
        if (!['100644', '100755', '120000'].includes(entry.mode)) { add(['unsupported-entry'], scope, id); continue; }
        const object = objects.get(entry.oid);
        requireComplete(object?.type === 'blob');
        if (scope === 'index') scan(object.content, scope, id);
        if (entry.mode !== '120000') continue;
        const target = entries.find(candidate => candidate.path === 'AGENTS.md');
        if (entry.path !== 'CLAUDE.md' || !object.content.equals(Buffer.from('AGENTS.md')) || !target || !['100644', '100755'].includes(target.mode)) add(['unsafe-link'], scope, id);
      }
    };
    for (const tree of trees) inspectEntries(parseEntries(await source.git(['ls-tree', '-r', '-t', '-z', '--full-tree', tree]), false), 'history');
    inspectEntries(indexEntries, 'index');
    const worktree = new Map<string, WorktreeFile>();
    for (const [offset, entry] of indexEntries.entries()) {
      const file = await source.worktree(entry.path);
      worktree.set(entry.path, file);
      if (file.kind === 'missing') continue;
      if (file.kind === 'unsupported') { add(['unsupported-entry'], 'worktree', offset + 1); continue; }
      scan(file.content, 'worktree', offset + 1);
    }
    for (const [offset, entry] of indexEntries.entries()) {
      const file = worktree.get(entry.path)!;
      if (file.kind === 'symlink' && (entry.path !== 'CLAUDE.md' || !file.content.equals(Buffer.from('AGENTS.md')) || worktree.get('AGENTS.md')?.kind !== 'file')) add(['unsafe-link'], 'worktree', offset + 1);
      const after = await source.worktree(entry.path);
      requireComplete(after.kind === file.kind && after.fingerprint === file.fingerprint && after.content.equals(file.content));
    }
    await assertRepository(source);
    requireComplete(snapshotEqual(before, await inventory(source)) && source.now() - started <= LIMITS.elapsedMs);
    return { exitCode: findings.length ? 1 : 0, findings, inspected };
  } catch {
    add(['incomplete-inspection'], 'inspection', 0);
    return { exitCode: 2, findings, inspected };
  }
}

export function renderResult(result: Result): string {
  return JSON.stringify({ exitCode: result.exitCode, inspected: result.inspected, findings: result.findings });
}
