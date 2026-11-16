// src/sweep.mjs
import { execFileSync } from "node:child_process";
var args = process.argv.slice(2);
var apply = args.includes("--apply");
var prefix = args.includes("--prefix") ? args[args.indexOf("--prefix") + 1] : "idea/";
var run = (cmd, a, opts = {}) => execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
var orca = (...a) => JSON.parse(run("orca", [...a, "--json"])).result;
var { worktrees } = orca("worktree", "list");
var candidates = worktrees.filter((w) => !w.isMainWorktree && w.branch?.replace(/^refs\/heads\//, "").startsWith(prefix));
var removed = [];
var stuck = [];
for (const w of candidates) {
  const branch = w.branch.replace(/^refs\/heads\//, "");
  const label = `${branch} (${w.path})`;
  try {
    const prs = JSON.parse(run("gh", ["pr", "list", "--head", branch, "--state", "all", "--json", "number,state,headRefOid,url"], { cwd: w.path }));
    const pr = prs[0];
    if (!pr) {
      stuck.push(`${label}: no PR yet`);
      continue;
    }
    if (pr.state === "OPEN") {
      stuck.push(`${label}: PR open ${pr.url}`);
      continue;
    }
    if (pr.state === "CLOSED") {
      stuck.push(`${label}: PR closed unmerged ${pr.url}`);
      continue;
    }
    const head = run("git", ["rev-parse", "HEAD"], { cwd: w.path }).trim();
    if (head !== pr.headRefOid) {
      stuck.push(`${label}: local commits differ from merged PR ${pr.url}`);
      continue;
    }
    if (run("git", ["status", "--porcelain"], { cwd: w.path }).trim()) {
      stuck.push(`${label}: uncommitted changes`);
      continue;
    }
    if (apply) run("orca", ["worktree", "rm", "--worktree", `id:${w.id}`, "--delete-branch", "--json"]);
    removed.push(label);
  } catch (e) {
    stuck.push(`${label}: ${String(e.stderr || e.message).split("\n")[0]}`);
  }
}
console.log(`${apply ? "removed" : "would remove"} ${removed.length}:`);
for (const r of removed) console.log(`  - ${r}`);
console.log(`stuck ${stuck.length}:`);
for (const s of stuck) console.log(`  - ${s}`);
