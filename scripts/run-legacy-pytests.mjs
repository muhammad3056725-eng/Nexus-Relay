#!/usr/bin/env node
// Runs the retired v1 pipeline's Python tests (legacy/pipeline/tests)
// portably: tries `python`, then `python3`, then `py -3`. If no Python
// with pytest is available, it prints a note and exits 0 (skip) — the
// v1 pipeline is not part of the game build any more.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = join(root, "legacy", "pipeline", "tests");
if (!existsSync(testsDir)) {
  console.log("legacy pytests: no legacy/pipeline/tests — skipped");
  process.exit(0);
}
const candidates = [["python"], ["python3"], ["py", "-3"]];
for (const [cmd, ...pre] of candidates) {
  const probe = spawnSync(cmd, [...pre, "-c", "import pytest"], { stdio: "ignore", shell: false });
  if (probe.status !== 0) continue;
  const res = spawnSync(cmd, [...pre, "-B", "-m", "pytest", testsDir, "-q", "-p", "no:cacheprovider"], {
    stdio: "inherit",
    cwd: root,
  });
  process.exit(res.status ?? 1);
}
console.log("legacy pytests: no Python with pytest found — skipped");
process.exit(0);
