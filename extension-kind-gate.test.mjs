// Self-contained regression tests for the dead-app-route guard added to
// extension-kind-gate.mjs. Uses only node:test + node:assert — no
// dependency, so it runs in the standalone CI before any install.
//
//   node --test extension-kind-gate.test.mjs
//
// The guard must FAIL on a reference to a known-dead app route and must NOT
// false-fire on a live route (e.g. /workflows still exists) or a nested route
// (/teams/{teamId}/settings) or the live replacement routes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEAD_APP_ROUTES, iterMarkdownLines, validateNoDeadAppRoutes } from "./extension-kind-gate.mjs";

function routesHit(line) {
  const out = [];
  for (const { route, pattern } of DEAD_APP_ROUTES) {
    pattern.lastIndex = 0;
    if (pattern.test(line)) out.push(route);
  }
  return out.sort();
}

test("dead routes fire in markdown-link, backtick, and bare-prose forms", () => {
  assert.deepEqual(routesHit("[Open settings](/settings)"), ["/settings"]);
  assert.deepEqual(routesHit("- Settings: `/settings`"), ["/settings"]);
  assert.deepEqual(routesHit("go to /settings now"), ["/settings"]);
  assert.deepEqual(routesHit("Redirect to `/settings/connections`."), ["/settings/connections"]);
  assert.deepEqual(routesHit("[x](/settings/connections)"), ["/settings/connections"]);
  assert.deepEqual(routesHit("[reg](/agents/registry)"), ["/agents/registry"]);
});

test("bare /settings does not also report /settings/connections (no double-count)", () => {
  // The /settings rule forbids a trailing slash, so the connections line is
  // reported by exactly one (the more specific) rule.
  assert.deepEqual(routesHit("[x](/settings/connections)"), ["/settings/connections"]);
});

test("absolute cinatra app URLs are caught; third-party URLs are not", () => {
  assert.deepEqual(routesHit("See https://app.cinatra.ai/settings for prefs"), ["/settings"]);
  assert.deepEqual(routesHit("https://cinatra.ai/settings/connections"), ["/settings/connections"]);
  assert.deepEqual(routesHit("https://demo.cinatra.app/agents/registry"), ["/agents/registry"]);
  assert.deepEqual(routesHit("https://cinatra.ai/settings"), ["/settings"]); // bare apex host
  assert.deepEqual(routesHit("https://cinatra.ai:443/settings"), ["/settings"]); // explicit port
  // A non-cinatra host that merely shares a path must NOT fire.
  assert.deepEqual(routesHit("https://github.com/settings"), []);
  assert.deepEqual(routesHit("https://example.com/settings/connections"), []);
  // A look-alike host that merely ends in "cinatra.ai" must NOT fire.
  assert.deepEqual(routesHit("https://evilcinatra.ai/settings"), []);
  assert.deepEqual(routesHit("https://notcinatra.app/agents/registry"), []);
});

test("live and nested routes do NOT false-fire", () => {
  assert.deepEqual(routesHit("/teams/{teamId}/settings is fine"), []);
  assert.deepEqual(routesHit("[t](/teams/abc/settings)"), []);
  assert.deepEqual(routesHit("use /connectors instead"), []);
  assert.deepEqual(routesHit("the /account page"), []);
  assert.deepEqual(routesHit("/agents/run is live"), []);
  assert.deepEqual(routesHit("/workflows still exists"), []); // /workflows is NOT removed
  assert.deepEqual(routesHit("settings without slash"), []);
  assert.deepEqual(routesHit("mysettings/x"), []);
});

test("fenced code blocks are skipped, real links are not", () => {
  const md = "```\n[x](/settings)\n```\n[y](/settings)\n";
  const lines = [...iterMarkdownLines(md)].map((l) => l.text);
  assert.deepEqual(lines, ["[y](/settings)", ""]);
});

test("validateNoDeadAppRoutes scans .md files and reports file:line + replacement", () => {
  const dir = mkdtempSync(join(tmpdir(), "deadroute-"));
  try {
    mkdirSync(join(dir, "skills", "demo"), { recursive: true });
    writeFileSync(
      join(dir, "skills", "demo", "SKILL.md"),
      "# demo\nCredentials live on `/settings/connections`.\nOpen [settings](/settings).\n```\n[ignored](/settings)\n```\n",
    );
    writeFileSync(join(dir, "skills", "demo", "ok.md"), "All good: [connectors](/connectors).\n");
    const errs = validateNoDeadAppRoutes(dir);
    assert.equal(errs.length, 2);
    assert.ok(errs.some((e) => e.includes("/settings/connections") && e.includes("/connectors")));
    assert.ok(errs.some((e) => e.includes("references dead app route /settings") && e.includes("/account")));
    assert.ok(errs.every((e) => /SKILL\.md:\d+/.test(e)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a clean tree yields no errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "deadroute-clean-"));
  try {
    writeFileSync(join(dir, "README.md"), "Go to /connectors or /account or /workflows.\n");
    assert.deepEqual(validateNoDeadAppRoutes(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
