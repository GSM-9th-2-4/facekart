#!/usr/bin/env node
// PostToolUse hook: after Claude edits a file, give it immediate feedback.
// - src/data/**/*.json -> must parse; karts.json must match the schema
// - *.ts / *.tsx       -> tsc --noEmit (only once the project is set up)
// Exit 2 + stderr = Claude sees the problem and fixes it. Exit 0 = silent.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

const input = readStdin();
const filePath = input?.tool_input?.file_path;
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const rel = relative(projectDir, filePath).split(sep).join('/');
const fail = (msg) => {
  process.stderr.write(`[post-edit hook] ${msg}\n`);
  process.exit(2);
};

// ---- data files -----------------------------------------------------------
if (rel.startsWith('src/data/') && rel.endsWith('.json')) {
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`${rel} is not valid JSON: ${e.message}`);
  }

  if (rel === 'src/data/karts.json') {
    const karts = Array.isArray(data) ? data : data?.karts;
    if (!Array.isArray(karts)) fail('karts.json must be an array of karts (or { "karts": [...] }).');
    const problems = [];
    const ids = new Set();
    for (const [i, k] of karts.entries()) {
      const where = `karts[${i}]${k?.id ? ` (${k.id})` : ''}`;
      for (const key of ['id', 'name', 'tier']) {
        if (typeof k?.[key] !== 'string' || !k[key]) problems.push(`${where}: missing string "${key}"`);
      }
      if (k?.id) {
        if (ids.has(k.id)) problems.push(`${where}: duplicate id`);
        ids.add(k.id);
      }
      for (const s of ['topSpeed', 'accel', 'cornering', 'boostCharge']) {
        const v = k?.stats?.[s];
        if (typeof v !== 'number' || v < 1 || v > 10) problems.push(`${where}: stats.${s} must be a number 1-10 (got ${v})`);
      }
    }
    if (problems.length) fail(`karts.json schema problems:\n- ${problems.join('\n- ')}`);
  }

  if (rel.startsWith('src/data/tracks/')) {
    const problems = [];
    for (const key of ['id', 'name', 'theme']) {
      if (typeof data?.[key] !== 'string') problems.push(`missing string "${key}"`);
    }
    if (!Array.isArray(data?.waypoints) || data.waypoints.length < 4) problems.push('"waypoints" needs at least 4 points');
    else if (!data.waypoints.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)))
      problems.push('every waypoint must be [x, y, z] numbers');
    if (typeof data?.width !== 'number' || data.width <= 0) problems.push('"width" must be a positive number');
    if (problems.length) fail(`${rel} problems:\n- ${problems.join('\n- ')}`);
  }
  process.exit(0);
}

// ---- TypeScript -----------------------------------------------------------
if (!/\.(ts|tsx|mts)$/.test(rel) || rel.startsWith('node_modules/')) process.exit(0);

const hasTs = existsSync(join(projectDir, 'node_modules', 'typescript'));
const tsconfig = ['tsconfig.app.json', 'tsconfig.json'].find((f) => existsSync(join(projectDir, f)));
if (!hasTs || !tsconfig) process.exit(0); // project not set up yet

try {
  execSync(`npx --no-install tsc --noEmit -p ${tsconfig}`, {
    cwd: projectDir,
    stdio: 'pipe',
    timeout: 80_000,
    encoding: 'utf8',
  });
} catch (e) {
  if (e.code === 'ETIMEDOUT' || e.signal) process.exit(0); // don't block on a slow machine
  const out = `${e.stdout || ''}${e.stderr || ''}`.trim().split('\n');
  const shown = out.slice(0, 30).join('\n');
  const more = out.length > 30 ? `\n... ${out.length - 30} more lines` : '';
  fail(`TypeScript errors after editing ${rel} — fix them now:\n${shown}${more}`);
}
process.exit(0);
