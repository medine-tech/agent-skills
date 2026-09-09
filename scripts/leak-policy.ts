export type Rule = 'credential' | 'sensitive-assignment' | 'authenticated-url' | 'webhook' | 'local-path' | 'unapproved-reference' | 'private-file' | 'uninspectable-content' | 'unsafe-link' | 'unsupported-entry';

const publicRepositories = new Set([
  'medine-tech/agent-skills', 'actions/checkout', 'actions/setup-node',
  'microsoft/typescript', 'definitelytyped/definitelytyped', 'nodejs/node', 'vercel-labs/skills',
]);
const documentationHosts = new Set([
  'nodejs.org', 'docs.npmjs.com', 'www.typescriptlang.org', 'git-scm.com',
  'opensource.org', 'docs.coderabbit.ai', 'coderabbit.ai',
]);
const knownFormats = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/, /\bglpat-[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/, /\bnpm_[A-Za-z0-9]{30,}\b/,
  /\blin_api_[A-Za-z0-9]{30,}\b/, /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/,
  /\b[rs]k_(?:live|test)_[A-Za-z0-9]{20,}\b/, /\bAIza[A-Za-z0-9_-]{30,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
];

function normalize(value: string): string {
  let current = value;
  for (let pass = 0; pass < 3; pass++) {
    const decoded = current.replace(/%([a-f\d]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
    if (current === decoded) break;
    current = decoded;
  }
  return current;
}

function isApprovedUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const hostname = url.hostname.toLowerCase();
    if (documentationHosts.has(hostname)) return true;
    if (hostname === 'registry.npmjs.org') {
      return /^\/(?:typescript|undici-types|@types\/node)\/-\/[a-z0-9._-]+\.tgz$/.test(url.pathname);
    }
    if (hostname !== 'github.com') return false;
    const parts = url.pathname.toLowerCase().split('/');
    const owner = parts[1];
    const repo = parts[2]?.replace(/\.git$/, '');
    if (!owner || !repo || !publicRepositories.has(`${owner}/${repo}`)) return false;
    if (parts.length <= 3 || (parts.length === 4 && parts[3] === '')) return true;
    return ['tree', 'blob', 'commit', 'pull', 'issues', 'releases', 'actions'].includes(parts[3] ?? '');
  } catch { return false; }
}

function isApprovedAction(reference: string): boolean {
  const repository = reference.split('@')[0]!.split('/').slice(0, 2).join('/').toLowerCase();
  return /^[a-z0-9_.-]+\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*(?:@[^\s"'#]+)?$/i.test(reference) && publicRepositories.has(repository);
}

function hasSensitiveAssignment(value: string): boolean {
  const identifiers = /[A-Z0-9_-]+/gi;
  let identifier: RegExpExecArray | null;
  while ((identifier = identifiers.exec(value)) !== null) {
    if (!/(?:API[_-]?KEY|ACCESS[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i.test(identifier[0])) continue;
    let cursor = identifiers.lastIndex;
    if (value[cursor] === '"' || value[cursor] === "'") cursor++;
    while (cursor < value.length && /\s/.test(value[cursor]!)) cursor++;
    if (value[cursor] !== ':' && value[cursor] !== '=') continue;
    cursor++;
    while (cursor < value.length && /\s/.test(value[cursor]!)) cursor++;
    const isQuoted = value[cursor] === '"' || value[cursor] === "'";
    if (isQuoted) cursor++;
    const start = cursor;
    const delimiter = isQuoted ? /["'\r\n]/ : /[\s,;"']/;
    while (cursor < value.length && !delimiter.test(value[cursor]!)) cursor++;
    const assigned = value.slice(start, cursor);
    identifiers.lastIndex = cursor;
    if (assigned && !/^(?:false|true|null)$/.test(assigned) && !/^\$(?:\{[A-Z_][A-Z0-9_]*\}|[A-Z_][A-Z0-9_]*)$/i.test(assigned)) return true;
  }
  return false;
}

function hasWebhook(value: string): boolean {
  const lower = value.toLowerCase();
  for (const segment of lower.matchAll(/[^\s/]+/g)) {
    const end = segment.index + segment[0].length;
    if ((lower.startsWith(['/api/', 'webhooks/'].join(''), end) || lower.startsWith(['/web', 'hook/'].join(''), end) || lower.startsWith(['/web', 'hook?'].join(''), end)) && /\w/.test(segment[0])) return true;
  }
  for (const hostname of lower.matchAll(/[a-z0-9.-]+/g)) {
    if (lower[hostname.index + hostname[0].length] !== '/') continue;
    let cursor = hostname[0].indexOf('hooks.');
    while (cursor !== -1) {
      const before = lower[hostname.index + cursor - 1];
      if ((!before || !/\w/.test(before)) && cursor + 6 < hostname[0].length) return true;
      cursor = hostname[0].indexOf('hooks.', cursor + 6);
    }
  }
  return false;
}

export function inspectContent(text: string): Rule[] {
  const value = normalize(text);
  const rules = new Set<Rule>();
  if (knownFormats.some(pattern => pattern.test(value))) rules.add('credential');
  if (hasSensitiveAssignment(value)) rules.add('sensitive-assignment');
  if (/(?:https?|ssh):\/\/[^\s/<>'"`]*@/i.test(value)) rules.add('authenticated-url');
  if (hasWebhook(value)) rules.add('webhook');
  if (/(?:\/(?:Users|home|root|private|tmp|var\/folders)\/|\b[A-Z]:[\\/]|\\\\[a-z0-9_.-]+\\|\bfile:\/\/)/i.test(value)) rules.add('local-path');
  for (const match of value.matchAll(/\b(?:https?|ssh|git|file):\/\/[^\s<>"'`\])}]+/gi)) {
    const candidate = match[0].replace(/[.,;]+$/, '');
    if (!isApprovedUrl(candidate)) rules.add('unapproved-reference');
  }
  for (const match of value.matchAll(/(?<![:/])\/\/[a-z0-9][^\s<>"'`\])}]+/gi)) {
    const candidate = match[0].replace(/[.,;]+$/, '');
    if (!isApprovedUrl('https:' + candidate)) rules.add('unapproved-reference');
  }
  for (const match of value.matchAll(/(?:\bgit@|\bgithub:|(?<!\/\/)\bgithub\.com[/:])([^\s<>"'`\])}]+)/gi)) {
    const candidate = match[0].startsWith(['github', ':'].join('')) ? match[1]! : match[0].replace(/^git\x40github\.com:/i, '').replace(/^github\.com[/:]/i, '');
    if (!isApprovedUrl(['https:', ['/', '/', 'github.com/'].join(''), candidate].join(''))) rules.add('unapproved-reference');
  }
  for (const match of value.matchAll(/(?<![a-z0-9_.\/@-])([a-z0-9_.-]+\/[^\s"'`<>()\[\]{},;:@]+@[^\s"'`<>()\[\]{},;:@]+)/gi)) {
    if (!isApprovedAction(match[1]!)) rules.add('unapproved-reference');
  }
  for (const match of value.matchAll(/(?:\buses|"uses"|'uses')\s*\x3a\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s#\r\n]+))/gi)) {
    if (!isApprovedAction(match[1] ?? match[2] ?? match[3] ?? '')) rules.add('unapproved-reference');
  }
  for (const match of value.matchAll(/\bmedine-tech\/([a-z0-9_.-]+)/gi)) {
    if (!publicRepositories.has(`medine-tech/${match[1]!.toLowerCase()}`.replace(/\.git$/, ''))) rules.add('unapproved-reference');
  }
  return [...rules];
}

export function inspectPath(path: string): Rule[] {
  const rules = new Set(inspectContent(path));
  const value = normalize(path).replace(/\\/g, '/').toLowerCase();
  const components = value.split('/');
  if (components.some(part => /^\.env/.test(part)) ||
      /(?:^|\/)(?:\.agents\/plans|evidence|artifacts|reports|\.codex|\.claude)(?:\/|$)/.test(value)) rules.add('private-file');
  return [...rules];
}

export function decodeDocument(bytes: Buffer): string | undefined {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return undefined;
    if (/^version https:\/\/git-lfs\.github\.com\/spec\/v1(?:\r?\n|$)/.test(text)) return undefined;
    return text;
  } catch { return undefined; }
}
