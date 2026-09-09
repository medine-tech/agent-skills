import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLeaks, renderResult } from '../scripts/leak-check.ts';
import { Synthetic, commit, entry, indexed, oid, repository } from './support/synthetic.ts';

async function inspectText(content: string | Buffer) {
  const repo = repository();
  repo.objects.get(oid(3))!.data = Buffer.from(content);
  return checkLeaks(repo.source);
}
function assertRedacted(result: Awaited<ReturnType<typeof checkLeaks>>, forbidden: string[]) {
  const output = renderResult(result);
  for (const value of forbidden) assert.ok(!output.includes(value), 'diagnostic disclosed input');
  assert.ok(!output.includes('Error:'));
  assert.ok(!output.includes(' at '));
  return output;
}

test('safe empty-skill repository inspects every declared surface', async () => {
  const repo = repository();
  const result = await checkLeaks(repo.source);
  assert.equal(result.exitCode, 0);
  assert.ok(repo.calls.some(args => args[0] === 'rev-list' && args.includes('--all') && args.includes('--missing=error')));
  assert.ok(repo.calls.some(args => args[0] === 'ls-files' && args.includes('-z')));
  assert.ok(repo.reads.includes('README.md'));
  assert.match(renderResult(result), /"exitCode":0/);
});

const badContents = [
  Synthetic.token(), ['AK', 'IA', 'B'.repeat(16)].join(''), ['AS', 'IA', 'C'.repeat(16)].join(''),
  ['github', '_pat_', 'A'.repeat(82)].join(''), ['gl', 'pat-', 'a'.repeat(24)].join(''),
  ['xox', 'b-', '1'.repeat(12), '-', '2'.repeat(12), '-', 'a'.repeat(24)].join(''),
  ['npm', '_', 'a'.repeat(36)].join(''), ['lin', '_api_', 'a'.repeat(40)].join(''),
  ['sk', '-proj-', 'a'.repeat(48)].join(''), ['sk', '_live_', 'a'.repeat(30)].join(''),
  ['AI', 'za', 'a'.repeat(35)].join(''), ['ey', 'J', 'a'.repeat(20), '.ey', 'J', 'b'.repeat(20), '.', 'c'.repeat(32)].join(''),
  ['-----BEGIN ', 'PRIVATE KEY-----'].join(''), ['api', '_key', ' = "', 'synthetic-value', '"'].join(''),
  ['password', ': ', 'synthetic-value'].join(''),
  ['https:', ['/', '/', 'person:pass@github.com/medine-tech/agent-skills'].join('')].join(''),
  ['https:', ['/', '/', 'hooks.'].join(''), 'slack.com', '/services/', 'A/B/C'].join(''),
  ['https:', ['/', '/', 'discord.com'].join(''), '/api/', 'webhooks/', '123/abc'].join(''),
  Synthetic.unsafePath(), ['/', 'home', '/someone/secrets'].join(''), ['C:', String.fromCharCode(92), 'Users', String.fromCharCode(92), 'someone', String.fromCharCode(92), 'private'].join(''),
  [String.fromCharCode(92).repeat(2), 'server', String.fromCharCode(92), 'share', String.fromCharCode(92), 'private'].join(''), ['file', '://', '/', 'private', '/data'].join(''),
  Synthetic.privateRepo(), ['git', '@', 'github.com', ':', 'synthetic-team/confidential'].join(''),
  ['https:', ['/', '/', 'github.com/'].join(''), 'medine-tech', '/', 'agent-skills-evil'].join(''),
  ['https:', ['/', '/', 'github.'].join(''), 'com.evil.test', '/medine-tech', '/agent-skills'].join(''),
  ['https:', ['/', '/', 'github.'].join(''), 'com/', 'medine-tech', '%2f', 'confidential'].join(''),
  ['https:', ['/', '/', 'github.com/'].join(''), 'medine-tech', '/', 'agent-skills.git.evil'].join(''),
  ['https:', ['/', '/', 'internal.example.test/data'].join('')].join(''),
];
for (const [index, content] of badContents.entries()) {
  test(`rejects unsafe content family ${index + 1} without disclosure`, async () => {
    const result = await inspectText(content);
    assert.equal(result.exitCode, 1);
    assert.ok(result.findings.length > 0);
    assertRedacted(result, [content, Synthetic.unsafePath()]);
  });
}
for (const safe of [Synthetic.safeDocument(), 'API_KEY\nTOKEN\n${API_KEY}', 'API_KEY=""', ['persist-', 'credentials: false'].join(''),
  'https://github.com/medine-tech/agent-skills', 'https://github.com/medine-tech/agent-skills.git',
  'https://github.com/medine-tech/agent-skills/tree/main/docs',
  'https://GITHUB.COM/MEDINE-TECH/AGENT-SKILLS',
  'https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz']) {
  test(`safe content variant ${safe.length} is accepted`, async () => assert.equal((await inspectText(safe)).exitCode, 0));
}

test('deleted historical secret remains blocked', async () => {
  const repo = repository();
  repo.objects.set(oid(4), { type: 'blob', data: Buffer.from(Synthetic.token()) });
  repo.state.ids += `${oid(4)}\n`;
  assert.equal((await checkLeaks(repo.source)).exitCode, 1);
});
test('each historical path is inspected even when its blob was already scanned', async () => {
  const repo = repository();
  repo.trees.set(oid(2), entry('safe.md') + entry(['.', 'env'].join('')));
  const result = await checkLeaks(repo.source);
  assert.equal(result.exitCode, 1);
  assert.ok(result.findings.some(finding => finding.rule === 'private-file'));
});
for (const location of ['index', 'worktree']) {
  test(`a safe counterpart cannot hide a secret in ${location}`, async () => {
    const repo = repository();
    if (location === 'index') {
      repo.objects.set(oid(4), { type: 'blob', data: Buffer.from(Synthetic.token()) });
      repo.state.index = indexed('README.md', oid(4));
    } else repo.files.get('README.md')!.content = Buffer.from(Synthetic.token());
    const result = await checkLeaks(repo.source);
    assert.equal(result.exitCode, 1);
    assert.ok(result.findings.some(finding => finding.scope === location));
  });
}
for (const location of ['commit', 'tag', 'ref']) {
  test(`inspects ${location} metadata`, async () => {
    const repo = repository();
    if (location === 'commit') repo.objects.get(oid(1))!.data = Buffer.from(commit(oid(2), Synthetic.token()));
    if (location === 'tag') {
      repo.objects.set(oid(4), { type: 'tag', data: Buffer.from(`object ${oid(3)}\ntype blob\ntag release\n\n${Synthetic.token()}`) });
      repo.state.ids += `${oid(4)}\n`;
      repo.state.refs += `${oid(4)} refs/tags/release\n`;
    }
    if (location === 'ref') repo.state.refs += `${oid(1)} refs/heads/${Synthetic.token()}\n`;
    const result = await checkLeaks(repo.source);
    assert.equal(result.exitCode, 1);
    assertRedacted(result, [Synthetic.token(), repo.state.refs]);
  });
}
test('tree tag targets receive path inspection', async () => {
  const repo = repository();
  repo.objects.set(oid(4), { type: 'tag', data: Buffer.from(`object ${oid(5)}\ntype tree\ntag release\n\nsafe`) });
  repo.objects.set(oid(5), { type: 'tree', data: Buffer.from('tree bytes') });
  repo.trees.set(oid(5), entry(['.', 'env'].join('')));
  repo.state.ids += `${oid(4)}\n${oid(5)}\n`;
  repo.state.refs += `${oid(4)} refs/tags/release\n`;
  assert.equal((await checkLeaks(repo.source)).exitCode, 1);
});

const failureCases = [
  (repo: ReturnType<typeof repository>) => { repo.state.shallow = 'true\n'; },
  (repo: ReturnType<typeof repository>) => { repo.state.config = 'remote.origin.promisor\ntrue\0'; },
  (repo: ReturnType<typeof repository>) => { repo.state.config = 'extensions.partialclone\norigin\0'; },
  (repo: ReturnType<typeof repository>) => { repo.state.replacements = `${oid(1)} refs/replace/item\n`; },
  (repo: ReturnType<typeof repository>) => { repo.state.grafts = true; },
  (repo: ReturnType<typeof repository>) => { repo.state.failure = Synthetic.unsafePath(); },
  (repo: ReturnType<typeof repository>) => { repo.objects.delete(oid(3)); },
  (repo: ReturnType<typeof repository>) => { repo.state.batch = Buffer.from(`${oid(1)} commit 500\nshort\n`); },
  (repo: ReturnType<typeof repository>) => { repo.state.batch = Buffer.from('ambiguous\n'); },
  (repo: ReturnType<typeof repository>) => { repo.state.ids = 'malformed\n'; },
  (repo: ReturnType<typeof repository>) => { repo.state.index = indexed('README.md', oid(3), '100644', 1); },
  (repo: ReturnType<typeof repository>) => { repo.state.index = 'truncated'; },
  (repo: ReturnType<typeof repository>) => { repo.state.mutate = true; },
  (repo: ReturnType<typeof repository>) => { repo.objects.get(oid(3))!.type = 'unknown'; },
  (repo: ReturnType<typeof repository>) => { repo.objects.get(oid(3))!.data = Buffer.alloc(2 * 1024 * 1024 + 1, 65); },
];
for (const [index, mutate] of failureCases.entries()) {
  test(`incomplete inspection ${index + 1} fails closed with safe output`, async () => {
    const repo = repository(); mutate(repo);
    const result = await checkLeaks(repo.source);
    assert.equal(result.exitCode, 2);
    assertRedacted(result, [Synthetic.unsafePath(), 'malformed', 'truncated', 'ambiguous']);
  });
}
for (const bytes of [Buffer.from([0xc3, 0x28]), Buffer.from([0, 1, 2]), Buffer.from([1, 2, 3]), Buffer.from(['version https:', ['/', '/', 'git-lfs.'].join(''), 'github.com', '/spec/v1\noid sha256:abcd\nsize 1'].join(''))]) {
  test(`uninspectable blob ${bytes.length} is blocked`, async () => assert.equal((await inspectText(bytes)).exitCode, 1));
}

test('safe relative canonical alias is checked without following it', async () => {
  const repo = repository();
  repo.objects.set(oid(4), { type: 'blob', data: Buffer.from('AGENTS.md') });
  repo.state.ids += `${oid(4)}\n`;
  repo.state.index = indexed('AGENTS.md') + indexed('CLAUDE.md', oid(4), '120000');
  repo.trees.set(oid(2), entry('AGENTS.md') + entry('CLAUDE.md', oid(4), '120000'));
  repo.files.set('AGENTS.md', { kind: 'file', content: Buffer.from(Synthetic.safeDocument()), fingerprint: 'target' });
  repo.files.set('CLAUDE.md', { kind: 'symlink', content: Buffer.from('AGENTS.md'), fingerprint: 'link' });
  assert.equal((await checkLeaks(repo.source)).exitCode, 0);
  assert.ok(repo.reads.every(path => ['AGENTS.md', 'CLAUDE.md'].includes(path)));
});
for (const kind of ['external', 'alternative', 'missing-target', 'link-target', 'gitlink']) {
  test(`rejects unsafe alias case ${kind}`, async () => {
    const repo = repository();
    repo.objects.set(oid(4), { type: 'blob', data: Buffer.from(kind === 'external' ? Synthetic.unsafePath() : kind === 'alternative' ? './AGENTS.md' : 'AGENTS.md') });
    repo.state.ids += `${oid(4)}\n`;
    repo.trees.set(oid(2), entry('CLAUDE.md', oid(4), kind === 'gitlink' ? '160000' : '120000') + (kind === 'link-target' ? entry('AGENTS.md', oid(4), '120000') : ''));
    assert.notEqual((await checkLeaks(repo.source)).exitCode, 0);
  });
}
test('paths preserve spaces tabs newlines and Unicode at the I/O boundary', async () => {
  const repo = repository();
  const path = 'docs/guía con espacio\ttab\nsalto.md';
  repo.state.index = indexed(path);
  repo.trees.set(oid(2), entry(path));
  repo.files.set(path, { kind: 'file', content: Buffer.from('Texto seguro'), fingerprint: 'safe' });
  assert.equal((await checkLeaks(repo.source)).exitCode, 0);
  assert.deepEqual(repo.reads, [path, path]);
});
test('tracked private evidence is rejected', async () => {
  const repo = repository();
  repo.state.index = indexed(['.agents', 'plans', 'notes.md'].join('/'));
  assert.equal((await checkLeaks(repo.source)).exitCode, 1);
});
test('worktree changes during inspection cannot produce success', async () => {
  const repo = repository();
  let reads = 0;
  repo.source.worktree = async () => ({ kind: 'file', content: Buffer.from('Safe'), fingerprint: String(reads++) });
  assert.equal((await checkLeaks(repo.source)).exitCode, 2);
});
test('environment references remain safe when used as sensitive assignment values', async () => {
  const expression = ['API', '_KEY=', '${API_KEY}'].join('');
  assert.equal((await inspectText(expression)).exitCode, 0);
});

for (const name of ['local', 'rc', 'production']) {
  for (const scope of ['history', 'index']) {
    test(`environment filename suffix ${name} is rejected in ${scope} components`, async () => {
      const repo = repository();
      const path = ['docs', ['.', 'env', name].join(''), 'notes.md'].join('/');
      if (scope === 'history') repo.trees.set(oid(2), entry(path));
      else repo.state.index = indexed(path);
      const result = await checkLeaks(repo.source);
      assert.equal(result.exitCode, 1);
      assert.ok(result.findings.some(finding => finding.scope === scope && finding.rule === 'private-file'));
      assertRedacted(result, [path]);
    });
  }
}
for (const host of ['github.com', 'github.com.evil.test', 'github%2ecom.evil.test']) {
  test(`protocol-relative unknown reference on ${host} is rejected`, async () => {
    const content = ['/', '/', host, '/', 'synthetic-team', '/', 'confidential'].join('');
    const result = await inspectText(content);
    assert.equal(result.exitCode, 1);
    assertRedacted(result, [content]);
  });
}
test('protocol-relative approved repository uses the exact public allowlist', async () => {
  const content = ['/', '/', 'github.com', '/', 'medine-tech', '/', 'agent-skills'].join('');
  assert.equal((await inspectText(content)).exitCode, 0);
});
for (const suffix of ['-evil', '.git.evil']) {
  test(`protocol-relative repository suffix ${suffix} is rejected`, async () => {
    const content = ['/', '/', 'github.com', '/', 'medine-tech', '/', 'agent-skills', suffix].join('');
    assert.equal((await inspectText(content)).exitCode, 1);
  });
}
test('text diagnostics include an accurate source line without exposing content', async () => {
  const content = ['Título público', '', Synthetic.token(), 'Fin'].join('\n');
  const result = await inspectText(content);
  const finding = result.findings.find(item => item.rule === 'credential' && item.scope === 'history');
  assert.equal(finding?.line, 3);
  const output = assertRedacted(result, [Synthetic.token(), content]);
  assert.match(output, /"line":3/);
});
test('source line numbering does not count percent-encoded line breaks as physical lines', async () => {
  const content = ['Safe', ['prefix', '%0a', Synthetic.token()].join('')].join('\r\n');
  const result = await inspectText(content);
  assert.equal(result.findings.find(item => item.rule === 'credential')?.line, 2);
});
test('multiline detection survives source location enrichment', async () => {
  const content = ['API' + '_KEY =', '"synthetic-value"'].join('\n');
  const result = await inspectText(content);
  assert.equal(result.exitCode, 1);
  assert.ok(result.findings.some(item => item.rule === 'sensitive-assignment'));
  assertRedacted(result, [content, 'synthetic-value']);
});
test('non-text findings omit invalid source lines', async () => {
  const result = await inspectText(Buffer.from([0]));
  assert.equal(result.exitCode, 1);
  assert.ok(result.findings.every(item => item.line === undefined));
});
test('aggregate inspected bytes fail closed even when every blob fits the object limit', async () => {
  const repo = repository();
  repo.objects.get(oid(3))!.data = Buffer.alloc(2 * 1024 * 1024, 65);
  repo.state.index = Array.from({ length: 33 }, (_, index) => indexed(`docs/item-${index}.md`)).join('');
  const result = await checkLeaks(repo.source);
  assert.equal(result.exitCode, 2);
  assert.ok(result.inspected > 30, 'must reach aggregate inspection accounting');
  assertRedacted(result, [Synthetic.unsafePath()]);
});
for (const inventory of ['index', 'history', 'refs']) {
  test(`inventory item limit rejects excessive ${inventory}`, async () => {
    const repo = repository();
    if (inventory === 'index') repo.state.index = Array.from({ length: 10001 }, (_, index) => indexed(`item-${index}.md`)).join('');
    if (inventory === 'history') repo.state.ids = Array.from({ length: 10001 }, (_, index) => oid(index + 1)).join('\n') + '\n';
    if (inventory === 'refs') repo.state.refs = Array.from({ length: 10001 }, (_, index) => `${oid(1)} refs/heads/item-${index}\n`).join('');
    const result = await checkLeaks(repo.source);
    assert.equal(result.exitCode, 2);
    assert.ok(!repo.calls.some(args => args[0] === 'cat-file'));
  });
}
test('elapsed-time rejection uses the injected clock without waiting', async () => {
  const repo = repository();
  let clockReads = 0;
  repo.source.now = () => clockReads++ === 0 ? 0 : 120001;
  const result = await checkLeaks(repo.source);
  assert.equal(result.exitCode, 2);
  assert.ok(clockReads >= 2);
});
test('elapsed-time rejection also covers the final stable inventory check', async () => {
  const repo = repository();
  let elapsed = 0;
  let preflightReads = 0;
  const preflight = repo.source.preflight;
  repo.source.now = () => elapsed;
  repo.source.preflight = async () => {
    if (preflightReads++ > 0) elapsed = 120001;
    return preflight();
  };
  const result = await checkLeaks(repo.source);
  assert.equal(result.exitCode, 2);
});

for (const quote of ['', '"', "'"]) {
  for (const [label, owner, name, expected] of [
    ['unknown repository', 'synthetic-team', 'confidential', 1],
    ['approved repository', 'actions', 'checkout', 0],
    ['owner suffix', 'actions-evil', 'checkout', 1],
    ['repository suffix', 'actions', 'checkout-evil', 1],
    ['repository delimiter', 'actions', 'checkout$evil', 1],
  ] as const) {
    test(`workflow reference ${label} with quote ${quote || 'none'} follows exact allowlist`, async () => {
      const content = ['uses', ': ', quote, owner, '/', name, '@main', quote].join('');
      const result = await inspectText(content);
      assert.equal(result.exitCode, expected);
      if (expected) assertRedacted(result, [content]);
    });
  }
}

for (const scope of ['commit', 'direct-tree-tag']) {
  for (const [label, name, expected] of [
    ['safe directory', 'docs', 0],
    ['environment directory', ['.', 'env'].join(''), 1],
    ['credential directory', Synthetic.token(), 1],
  ] as const) {
    test(`${scope} includes ${label} even when its subtree is empty`, async () => {
      const repo = repository();
      repo.objects.set(oid(4), { type: 'tree', data: Buffer.alloc(0) });
      const rootTree = scope === 'commit' ? oid(2) : oid(5);
      repo.objects.set(rootTree, { type: 'tree', data: Buffer.concat([Buffer.from(`40000 ${name}\0`), Buffer.from(oid(4), 'hex')]) });
      repo.state.ids += `${oid(4)}\n`;
      if (scope === 'direct-tree-tag') {
        repo.state.ids += `${oid(5)}\n`;
        repo.state.refs += `${oid(5)} refs/tags/directory-snapshot\n`;
      }
      const git = repo.source.git;
      repo.source.git = async (args, input) => {
        if (args[0] === 'ls-tree' && args.at(-1) === rootTree) {
          repo.calls.push(args);
          return Buffer.from(args.includes('-t') ? `040000 tree ${oid(4)}\t${name}\0` : '');
        }
        return git(args, input);
      };
      const result = await checkLeaks(repo.source);
      assert.equal(result.exitCode, expected);
      assert.ok(repo.calls.some(args => args[0] === 'ls-tree' && args.includes('-r') && args.includes('-t')));
      if (expected) {
        assert.ok(result.findings.some(finding => finding.scope === 'history'));
        assertRedacted(result, [name]);
      }
    });
  }
}
test('tree container mode requires a real tree object', async () => {
  const repo = repository();
  repo.trees.set(oid(2), `040000 tree ${oid(3)}\tdocs\0`);
  assert.equal((await checkLeaks(repo.source)).exitCode, 2);
});
test('tree container cannot disguise a symlink mode', async () => {
  const repo = repository();
  repo.trees.set(oid(2), `120000 tree ${oid(2)}\tdocs\0`);
  assert.equal((await checkLeaks(repo.source)).exitCode, 2);
});

for (const key of ['uses', '"uses"', "'uses'", 'uses ']) {
  for (const quote of ['', '"', "'"]) {
    for (const [owner, name, expected] of [['actions', 'checkout', 0], ['synthetic-team', 'confidential', 1]] as const) {
      test(`workflow key ${key} and value quote ${quote || 'none'} retain repository policy ${expected}`, async () => {
        const content = [key, ': ', quote, owner, '/', name, '@main', quote].join('');
        const result = await inspectText(content);
        assert.equal(result.exitCode, expected);
        if (expected) assertRedacted(result, [content]);
      });
    }
  }
}
for (const prefix of ['action: &shared ', 'action: !!str ', '- ', 'Reference: `']) {
  for (const [owner, name, expected] of [['actions', 'checkout', 0], ['synthetic-team', 'confidential', 1]] as const) {
    test(`action token detection is independent of context ${prefix} for policy ${expected}`, async () => {
      const content = [prefix, owner, '/', name, '/nested/action', '@main'].join('');
      const result = await inspectText(content);
      assert.equal(result.exitCode, expected);
      if (expected) assertRedacted(result, [content]);
    });
  }
}
for (const [owner, name] of [['actions-evil', 'checkout'], ['actions', 'checkout-evil'], ['actions', 'checkout$evil']]) {
  test(`action token boundary ${owner} ${name} cannot borrow approved repository prefix`, async () => {
    const content = ['reference: ', owner, '/', name, '@main'].join('');
    assert.equal((await inspectText(content)).exitCode, 1);
  });
}
for (const content of ['docs/guide.md', 'contributor@example.org', ['@types', '/node', '@24.13.4'].join(''), 'Plain documentation with an @mention.']) {
  test(`non-action noise ${content.length} remains accepted`, async () => {
    assert.equal((await inspectText(content)).exitCode, 0);
  });
}
