// Publishes the packages npm/build.mjs made: the platform packages first, then `pqdoctor`, so the
// launcher never points at a version that isn't there yet. Skips a package whose version is
// already on npm, so a half-finished run can be re-run.
//
//   node npm/publish.mjs <out dir from build.mjs> [--dry-run] [--provenance]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PLATFORMS } from './build.mjs';

const [out, ...flags] = process.argv.slice(2);
if (!out) throw new Error('usage: node npm/publish.mjs <out dir> [--dry-run] [--provenance]');
const dryRun = flags.includes('--dry-run');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const name of [...PLATFORMS.map((p) => p.pkg), 'pqdoctor']) {
  const dir = path.join(out, name);
  const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  let published = false;
  try {
    published = execFileSync(npm, ['view', `${name}@${version}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' }).trim() === version;
  } catch {
    // E404: not published yet.
  }
  if (published) {
    console.log(`${name}@${version} is already on npm, skipping`);
    continue;
  }
  const a = ['publish', '--access', 'public', ...flags.filter((f) => f === '--dry-run' || f === '--provenance')];
  console.log(`${dryRun ? '[dry run] ' : ''}npm ${a.join(' ')}  (${name}@${version})`);
  execFileSync(npm, a, { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
}
