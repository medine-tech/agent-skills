import { performance } from 'node:perf_hooks';
import { checkLeaks, renderResult } from '../../scripts/leak-check.ts';
import { oid, repository } from './synthetic.ts';

const family = process.argv[2];
const ending = process.argv[3];
const sequence = family === 'dotted' ? 'a.' : ['TO', 'KEN_'].join('');
const tail = ending === 'assignment' ? ['\n', 'API', '_KEY', ' = "', 'synthetic-value', '"'].join('')
  : ending === 'webhook' ? ['\n', 'https:', '/', '/', 'hooks.', 'slack.com', '/services/', 'A/B/C'].join('') : '';
const size = 2 * 1024 * 1024;
const content = sequence.repeat(Math.ceil(size / sequence.length)).slice(0, size - tail.length) + tail;
const repo = repository();
repo.source.now = Date.now;
repo.objects.get(oid(3))!.data = Buffer.from(content);
const started = performance.now();
const result = await checkLeaks(repo.source);
const output = renderResult(result);
process.stdout.write(JSON.stringify({ exitCode: result.exitCode, bytes: Buffer.byteLength(content), elapsedMs: performance.now() - started, rules: [...new Set(result.findings.map(finding => finding.rule))], redacted: !output.includes(content) && (!tail || !output.includes(tail.trim())) }));
