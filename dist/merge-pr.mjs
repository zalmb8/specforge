import{createRequire}from'module';const require=createRequire(import.meta.url);

// src/merge.mjs
var GATE = /(^|\/|\s)specforge\/gate$/;
var OK = /* @__PURE__ */ new Set(["success", "skipped", "neutral"]);
function decideMerge(checkRuns) {
  const gate = checkRuns.find((r) => GATE.test(r.name));
  if (!gate) return { state: "wait", reason: "specforge/gate has not reported yet" };
  const pending = checkRuns.filter((r) => r.status !== "completed");
  if (pending.length) return { state: "wait", reason: `still running: ${pending.map((r) => r.name).join(", ")}` };
  const bad = checkRuns.filter((r) => !OK.has(r.conclusion));
  if (bad.length) return { state: "refuse", reason: `not green: ${bad.map((r) => `${r.name}=${r.conclusion}`).join(", ")}` };
  return { state: "merge", reason: "gate and all checks passed" };
}

// src/merge-pr.mjs
var [repo, number, ...rest] = process.argv.slice(2);
var timeoutS = Number(rest[rest.indexOf("--timeout-s") + 1]) || 600;
if (!repo || !number || !process.env.GH_TOKEN) {
  console.error("usage: GH_TOKEN=... merge-pr <owner/repo> <pr-number> [--timeout-s N]");
  process.exit(2);
}
var api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json", ...init.headers }
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
};
var deadline = Date.now() + timeoutS * 1e3;
for (; ; ) {
  const pr = await api(`/pulls/${number}`);
  if (!pr.ok) {
    console.error(`cannot read PR: ${pr.status}`);
    process.exit(1);
  }
  if (pr.body.merged) {
    console.log("already merged");
    process.exit(0);
  }
  if (pr.body.state !== "open") {
    console.error("PR is not open");
    process.exit(1);
  }
  const sha = pr.body.head.sha;
  const runs = await api(`/commits/${sha}/check-runs?per_page=100`);
  if (!runs.ok) {
    console.error(`cannot read checks: ${runs.status}`);
    process.exit(1);
  }
  const verdict = decideMerge(runs.body.check_runs);
  if (verdict.state === "refuse") {
    console.error(`refusing to merge: ${verdict.reason}`);
    process.exit(1);
  }
  if (verdict.state === "merge") {
    const m = await api(`/pulls/${number}/merge`, {
      method: "PUT",
      body: JSON.stringify({ merge_method: "squash", sha })
      // sha pins the merge to the commit we checked
    });
    if (!m.ok) {
      console.error(`merge failed: ${m.status} ${m.body.message}`);
      process.exit(1);
    }
    await api(`/git/refs/heads/${pr.body.head.ref}`, { method: "DELETE" });
    console.log(`merged #${number}`);
    process.exit(0);
  }
  if (Date.now() > deadline) {
    console.error(`timed out: ${verdict.reason}`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1e4));
}
