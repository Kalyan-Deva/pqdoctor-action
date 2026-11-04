#!/usr/bin/env node
// pqdoctor's npm launcher. The binary itself comes in one of the platform packages
// (optionalDependencies, picked by npm from their "os"/"cpu" fields); this finds it and runs it.
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// "<platform> <arch>" -> platform package. Windows on Arm runs the x64 build under emulation.
const PACKAGES = {
  'win32 x64': '@pqdoctor/win32-x64',
  'win32 arm64': '@pqdoctor/win32-x64',
  'darwin arm64': '@pqdoctor/darwin-universal',
  'darwin x64': '@pqdoctor/darwin-universal',
  'linux x64': '@pqdoctor/linux-x64',
  'linux arm64': '@pqdoctor/linux-arm64',
};

function binaryPath(platform = process.platform, arch = process.arch) {
  if (process.env.PQDOCTOR_BINARY) return process.env.PQDOCTOR_BINARY;
  const pkg = PACKAGES[`${platform} ${arch}`];
  if (!pkg) {
    throw new Error(
      `pqdoctor has no prebuilt binary for ${platform} ${arch}.\n` +
        'Build it from source instead: cargo install pqdoctor',
    );
  }
  let dir;
  try {
    dir = path.dirname(require.resolve(`${pkg}/package.json`));
  } catch {
    throw new Error(
      `The platform package ${pkg} isn't installed.\n` +
        'It is an optional dependency: reinstall without --no-optional / --omit=optional,\n' +
        'e.g. npm install -g pqdoctor',
    );
  }
  const exe = path.join(dir, 'bin', platform === 'win32' ? 'pqdoctor.exe' : 'pqdoctor');
  if (!fs.existsSync(exe)) throw new Error(`${pkg} is installed but has no binary at ${exe}`);
  if (platform !== 'win32') ensureExecutable(exe);
  return exe;
}

// A package packed on Windows loses the execute bit; put it back if we're allowed to.
function ensureExecutable(exe) {
  try {
    fs.accessSync(exe, fs.constants.X_OK);
  } catch {
    try {
      fs.chmodSync(exe, 0o755);
    } catch {
      // Not ours to change (e.g. a root-owned global install): spawning will say EACCES.
    }
  }
}

function main() {
  let exe;
  try {
    exe = binaryPath();
  } catch (e) {
    process.stderr.write(`pqdoctor: ${e.message}\n`);
    return 1;
  }
  const r = spawnSync(exe, process.argv.slice(2), { stdio: 'inherit', windowsHide: false });
  if (r.error) {
    process.stderr.write(`pqdoctor: couldn't start ${exe}: ${r.error.message}\n`);
    return 1;
  }
  if (r.signal) {
    process.kill(process.pid, r.signal);
    return 1;
  }
  return r.status ?? 1;
}

if (require.main === module) process.exitCode = main();

module.exports = { binaryPath, PACKAGES };
