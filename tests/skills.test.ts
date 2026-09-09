import assert from 'node:assert/strict';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const skillNames = ['grill-me', 'write-a-prd'];
const repositoryRoot = new URL('../', import.meta.url);
const skillsDirectory = new URL('skills', repositoryRoot);

test('the skills inventory contains exactly the two distributed leaves', () => {
  assert.ok(lstatSync(skillsDirectory).isDirectory());
  assert.deepEqual(readdirSync(skillsDirectory).sort(), skillNames);
});

for (const name of skillNames) {
  const directory = new URL(`skills/${name}`, repositoryRoot);
  const entrypoint = new URL(`skills/${name}/SKILL.md`, repositoryRoot);

  test(`${name} is a real directory containing only a regular SKILL.md`, () => {
    assert.ok(lstatSync(directory).isDirectory());
    assert.deepEqual(readdirSync(directory), ['SKILL.md']);
    assert.ok(lstatSync(entrypoint).isFile());
  });

  test(`${name} has the required simple metadata and a nonempty body`, () => {
    const lines = readFileSync(entrypoint, 'utf8').split(/\r?\n/);
    assert.equal(lines[0], '---');
    const closingDelimiter = lines.indexOf('---', 1);
    assert.ok(closingDelimiter > 1, 'frontmatter must have a closing delimiter');

    const fields = lines.slice(1, closingDelimiter).map(line => {
      const match = /^([a-z]+): (.+)$/.exec(line);
      assert.ok(match, 'metadata uses one plain field per line');
      return [match[1]!, match[2]!] as const;
    });
    assert.deepEqual(fields.map(([key]) => key).sort(), ['description', 'license', 'name']);
    const metadata = Object.fromEntries(fields);
    assert.equal(metadata.name, name);
    assert.ok(metadata.description?.trim());
    assert.equal(metadata.license, 'MIT');
    assert.ok(lines.slice(closingDelimiter + 1).join('\n').trim(), 'body must not be empty');
  });
}

test('README contains the public HTTPS discovery and installation commands', () => {
  const readme = readFileSync(new URL('README.md', repositoryRoot), 'utf8');
  const commands = [
    'npx skills add https://github.com/medine-tech/agent-skills --list',
    'npx skills add https://github.com/medine-tech/agent-skills --skill grill-me',
    'npx skills add https://github.com/medine-tech/agent-skills --skill write-a-prd',
  ];
  for (const command of commands) assert.ok(readme.includes(command), `missing command: ${command}`);
});
