import { checkLeaks, renderResult } from './leak-check.ts';
import { createGitSource } from './git-source.ts';

try {
  const result = await checkLeaks(await createGitSource(process.cwd()));
  process.stdout.write(renderResult(result) + '\n');
  process.exitCode = result.exitCode;
} catch {
  process.stderr.write('{"exitCode":2,"inspected":0,"findings":[{"rule":"incomplete-inspection","scope":"inspection","id":0}]}\n');
  process.exitCode = 2;
}
