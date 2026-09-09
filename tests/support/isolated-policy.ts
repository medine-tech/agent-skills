import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type LongTextFamily = 'dotted' | 'sensitive-name';
export type LongTextEnding = 'safe' | 'assignment' | 'webhook';
export type PolicySample = { exitCode: number; bytes: number; elapsedMs: number; rules: string[]; redacted: boolean };

export function isolatedPolicy(family: LongTextFamily, ending: LongTextEnding): PolicySample | undefined {
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./policy-child.ts', import.meta.url)), family, ending], { timeout: 10000, encoding: 'utf8', maxBuffer: 4096 });
  if (child.error || child.status !== 0) return undefined;
  try { return JSON.parse(child.stdout) as PolicySample; }
  catch { return undefined; }
}
