import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

// Prints a short-lived GitHub App installation token to stdout (nothing else).
// Config: ~/.config/specforge/app.json
//   { "appId": "...", "installationId": "...", "keychainService": "<name of the keychain item holding the PEM>" }
// Env overrides: SPECFORGE_APP_ID, SPECFORGE_INSTALLATION_ID, SPECFORGE_KEYCHAIN_SERVICE, SPECFORGE_APP_KEY_FILE.
let file = {};
try { file = JSON.parse(readFileSync(`${homedir()}/.config/specforge/app.json`, 'utf8')); } catch {}
const appId = process.env.SPECFORGE_APP_ID ?? file.appId;
const installationId = process.env.SPECFORGE_INSTALLATION_ID ?? file.installationId;
const service = process.env.SPECFORGE_KEYCHAIN_SERVICE ?? file.keychainService;
const keyFile = process.env.SPECFORGE_APP_KEY_FILE;
if (!appId || !installationId || !(service || keyFile)) {
  console.error('specforge: set appId, installationId and keychainService in ~/.config/specforge/app.json');
  process.exit(2);
}

const readKey = () => {
  if (keyFile) return readFileSync(keyFile, 'utf8');
  const raw = execFileSync('security', ['find-generic-password', '-s', service, '-w'], { encoding: 'utf8' }).trim();
  if (raw.includes('BEGIN')) return raw;
  // `security -w` returns hex when the value has newlines; also accept base64 of the PEM.
  return /^[0-9a-f]+$/i.test(raw) ? Buffer.from(raw, 'hex').toString('utf8') : Buffer.from(raw, 'base64').toString('utf8');
};

const b64u = (b) => Buffer.from(b).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64u(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }))}`;
const jwt = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(readKey()).toString('base64url')}`;

const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
  method: 'POST',
  headers: { authorization: `Bearer ${jwt}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
});
if (!res.ok) {
  console.error(`specforge: token request failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
process.stdout.write((await res.json()).token);
