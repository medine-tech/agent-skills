import type { Source, WorktreeFile } from '../../scripts/leak-check.ts';

export const Synthetic = {
  mergeSubject: (number = 17, ref = 'topic/documentation') => ['Merge pull request #', String(number), ' from ', 'medine-tech', '/', ref].join(''),
  safeDocument: () => 'Texto público en español. Configure API_KEY en su entorno.\n',
  token() { return ['gh', 'p_', 'a'.repeat(36)].join(''); },
  unsafePath: () => ['/', 'Users', '/synthetic-person/private.txt'].join(''),
  privateRepo: () => ['https:', ['/', '/', 'github.com/'].join(''), 'synthetic-team/confidential'].join(''),
};
export const oid = (n: number) => n.toString(16).padStart(40, '0');
export const entry = (path: string, id = oid(3), mode = '100644') => `${mode} blob ${id}\t${path}\0`;
export const indexed = (path: string, id = oid(3), mode = '100644', stage = 0) => `${mode} ${id} ${stage}\t${path}\0`;
export const commit = (tree = oid(2), message = 'Initial text') => `tree ${tree}\nauthor Public Contributor <contributor@example.org> 1 +0000\ncommitter Public Contributor <contributor@example.org> 1 +0000\n\n${message}\n`;
export type ObjectData = { type: string; data: Buffer };
export function repository() {
  const objects = new Map<string, ObjectData>([
    [oid(1), { type: 'commit', data: Buffer.from(commit()) }],
    [oid(2), { type: 'tree', data: Buffer.from('tree bytes') }],
    [oid(3), { type: 'blob', data: Buffer.from(Synthetic.safeDocument()) }],
  ]);
  const trees = new Map([[oid(2), entry('README.md')]]);
  const files = new Map<string, WorktreeFile>([['README.md', { kind: 'file', content: Buffer.from(Synthetic.safeDocument()), fingerprint: 'initial' }]]);
  const state = {
    head: `${oid(1)}\n`, refs: `${oid(1)} refs/heads/main\n`, index: indexed('README.md'),
    ids: [...objects.keys()].join('\n') + '\n', shallow: 'false\n', config: '', replacements: '', grafts: false,
    failure: '', batch: undefined as Buffer | undefined, mutate: false,
  };
  const calls: string[][] = [];
  const reads: string[] = [];
  let rounds = 0;
  const source: Source = {
    now: () => 0,
    async preflight() { return { shallow: Buffer.from(state.shallow), config: Buffer.from(state.config), replacements: Buffer.from(state.replacements), grafts: state.grafts }; },
    async git(args, input) {
      calls.push(args);
      if (state.failure) throw new Error(state.failure);
      switch (args[0]) {
        case 'rev-parse': return Buffer.from(state.head);
        case 'for-each-ref': rounds++; return Buffer.from(state.refs + (state.mutate && rounds > 1 ? `${oid(1)} refs/heads/new\n` : ''));
        case 'ls-files': return Buffer.from(state.index);
        case 'rev-list': return Buffer.from(state.ids);
        case 'ls-tree': return Buffer.from(trees.get(args.at(-1)!) ?? '');
        case 'cat-file': {
          if (state.batch) return state.batch;
          return Buffer.concat(input!.toString().trim().split('\n').map(id => {
            const object = objects.get(id);
            if (!object) return Buffer.from(`${id} missing\n`);
            return Buffer.concat([Buffer.from(`${id} ${object.type} ${object.data.length}\n`), object.data, Buffer.from('\n')]);
          }));
        }
        default: throw new Error('Unexpected command');
      }
    },
    async worktree(path) { reads.push(path); return files.get(path) ?? { kind: 'missing', content: Buffer.alloc(0), fingerprint: 'absent' }; },
  };
  return { source, objects, trees, files, state, calls, reads };
}
