import{createRequire}from'module';const require=createRequire(import.meta.url);

// src/mint-app-token.mjs
import { createSign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
var file = {};
try {
  file = JSON.parse(readFileSync(`${homedir()}/.config/specforge/app.json`, "utf8"));
} catch {
}
var appId = process.env.SPECFORGE_APP_ID ?? file.appId;
var installationId = process.env.SPECFORGE_INSTALLATION_ID ?? file.installationId;
var service = process.env.SPECFORGE_KEYCHAIN_SERVICE ?? file.keychainService;
var keyFile = process.env.SPECFORGE_APP_KEY_FILE;
if (!appId || !installationId || !(service || keyFile)) {
  console.error("specforge: set appId, installationId and keychainService in ~/.config/specforge/app.json");
  process.exit(2);
}
var readKey = () => {
  if (keyFile) return readFileSync(keyFile, "utf8");
  const raw = execFileSync("security", ["find-generic-password", "-s", service, "-w"], { encoding: "utf8" }).trim();
  if (raw.includes("BEGIN")) return raw;
  return /^[0-9a-f]+$/i.test(raw) ? Buffer.from(raw, "hex").toString("utf8") : Buffer.from(raw, "base64").toString("utf8");
};
var b64u = (b) => Buffer.from(b).toString("base64url");
var now = Math.floor(Date.now() / 1e3);
var unsigned = `${b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64u(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }))}`;
var jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(readKey()).toString("base64url")}`;
var res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
  method: "POST",
  headers: { authorization: `Bearer ${jwt}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" }
});
if (!res.ok) {
  console.error(`specforge: token request failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
process.stdout.write((await res.json()).token);
