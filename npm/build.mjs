// Builds the npm packages for one pqdoctor release from the build workflow's files.
//
//   node npm/build.mjs --version 0.4.0 --from <dir with the release files + SHA256SUMS.txt> --out <dir>
//
// Every file is checked against SHA256SUMS.txt before it goes into a package. Output: one folder
// per package under --out (the platform packages and `pqdoctor`, the launcher), each ready for
// `npm publish`. Publish the platform packages first (npm/publish.mjs does).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PLATFORMS = [
  { pkg: '@pqdoctor/win32-x64', asset: 'windows-x64', file: (v) => `pqdoctor-${v}-windows-x64.exe`, os: ['win32'], cpu: ['x64', 'arm64'], label: 'Windows x64' },
  { pkg: '@pqdoctor/darwin-universal', asset: 'macos-universal', file: (v) => `pqdoctor-${v}-macos-universal.tar.gz`, os: ['darwin'], cpu: ['arm64', 'x64'], label: 'macOS 11+ (Apple silicon and Intel)' },
  { pkg: '@pqdoctor/linux-x64', asset: 'linux-x64', file: (v) => `pqdoctor-${v}-linux-x64.tar.gz`, os: ['linux'], cpu: ['x64'], label: 'Linux x86_64 (static musl)' },
  { pkg: '@pqdoctor/linux-arm64', asset: 'linux-arm64', file: (v) => `pqdoctor-${v}-linux-arm64.tar.gz`, os: ['linux'], cpu: ['arm64'], label: 'Linux arm64 (static musl)' },
];

const COMMON = {
  license: 'MIT',
  homepage: 'https://pqdoctor.com',
  author: 'Kalyan Gopalam',
  keywords: ['post-quantum', 'tls', 'ml-kem', 'pqc', 'security', 'cli'],
};

export function parseSums(text) {
  const sums = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/);
    if (m) sums.set(m[2].trim(), m[1]);
  }
  return sums;
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function args(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(`unexpected ${argv[i]}`);
    a[argv[i].slice(2)] = argv[i + 1];
  }
  for (const k of ['version', 'from', 'out']) if (!a[k]) throw new Error(`--${k} is required`);
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(a.version)) throw new Error(`bad version ${a.version}`);
  return a;
}

export function build({ version, from, out }) {
  const sums = parseSums(fs.readFileSync(path.join(from, 'SHA256SUMS.txt'), 'utf8'));
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const license = fs.readFileSync(path.join(here, '..', 'LICENSE'));

  for (const p of PLATFORMS) {
    const name = p.file(version);
    const src = path.join(from, name);
    const want = sums.get(name);
    if (!want) throw new Error(`${name} isn't in SHA256SUMS.txt`);
    const got = sha256(src);
    if (got !== want) throw new Error(`${name}: SHA-256 ${got}, SHA256SUMS.txt says ${want}`);

    const dir = path.join(out, p.pkg);
    fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
    const exe = path.join(dir, 'bin', p.os[0] === 'win32' ? 'pqdoctor.exe' : 'pqdoctor');
    if (name.endsWith('.tar.gz')) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pqdoctor-npm-'));
      // Copy in and extract by bare name: GNU tar on Windows reads "C:\..." as a remote host.
      fs.copyFileSync(src, path.join(tmp, name));
      execFileSync('tar', ['xzf', name], { cwd: tmp, stdio: 'inherit' });
      fs.copyFileSync(path.join(tmp, name.replace(/\.tar\.gz$/, ''), 'pqdoctor'), exe);
      fs.rmSync(tmp, { recursive: true, force: true });
    } else {
      fs.copyFileSync(src, exe);
    }
    fs.chmodSync(exe, 0o755);
    fs.writeFileSync(path.join(dir, 'LICENSE'), license);
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      `# ${p.pkg}\n\nThe ${p.label} binary of [pqdoctor](https://www.npmjs.com/package/pqdoctor) ${version}, ` +
        `built from [crates.io/crates/pqdoctor/${version}](https://crates.io/crates/pqdoctor/${version}) by ` +
        `[pqdoctor-action's build workflow](https://github.com/Kalyan-Deva/pqdoctor-action).\n\n` +
        `Don't install this directly: \`npm install -g pqdoctor\` picks the right one.\n\n` +
        `SHA-256 of the release file (${name}): \`${want}\`\n`,
    );
    const pj = {
      name: p.pkg,
      version,
      description: `The ${p.label} binary for pqdoctor. Install "pqdoctor" instead.`,
      ...COMMON,
      os: p.os,
      cpu: p.cpu,
      files: ['bin', 'README.md', 'LICENSE'],
      preferUnplugged: true,
    };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pj, null, 2) + '\n');
  }

  // The launcher.
  const dir = path.join(out, 'pqdoctor');
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.copyFileSync(path.join(here, 'pqdoctor', 'bin', 'pqdoctor.js'), path.join(dir, 'bin', 'pqdoctor.js'));
  fs.copyFileSync(path.join(here, 'pqdoctor', 'README.md'), path.join(dir, 'README.md'));
  fs.writeFileSync(path.join(dir, 'LICENSE'), license);
  const pj = {
    name: 'pqdoctor',
    version,
    description: "Why isn't this server post-quantum? Hand-crafted TLS ClientHellos, a diagnosis and the fix.",
    ...COMMON,
    bin: { pqdoctor: 'bin/pqdoctor.js' },
    files: ['bin', 'README.md', 'LICENSE'],
    engines: { node: '>=18' },
    optionalDependencies: Object.fromEntries(PLATFORMS.map((p) => [p.pkg, version])),
  };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pj, null, 2) + '\n');
  return [...PLATFORMS.map((p) => p.pkg), 'pqdoctor'].map((n) => path.join(out, n));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dirs = build(args(process.argv.slice(2)));
  for (const d of dirs) console.log(d);
}
