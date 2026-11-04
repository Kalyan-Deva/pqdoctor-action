// node --test npm/launcher.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { PLATFORMS } from "./build.mjs";

const require = createRequire(import.meta.url);
const { binaryPath, PACKAGES } = require("./pqdoctor/bin/pqdoctor.js");

test("every launcher target is a package build.mjs makes, for an os/cpu it declares", () => {
  for (const [key, pkg] of Object.entries(PACKAGES)) {
    const [os, cpu] = key.split(" ");
    const p = PLATFORMS.find((x) => x.pkg === pkg);
    assert.ok(p, `${pkg} isn't built`);
    assert.ok(p.os.includes(os) && p.cpu.includes(cpu), `${pkg} doesn't install on ${key}`);
  }
});

test("an unknown platform points at cargo install", () => {
  delete process.env.PQDOCTOR_BINARY;
  assert.throws(() => binaryPath("aix", "ppc64"), /cargo install pqdoctor/);
});

test("a missing platform package says how to reinstall", () => {
  delete process.env.PQDOCTOR_BINARY;
  assert.throws(() => binaryPath("linux", "arm64"), /optional dependency/);
});

test("PQDOCTOR_BINARY overrides the lookup", () => {
  process.env.PQDOCTOR_BINARY = "/opt/pqdoctor";
  try {
    assert.equal(binaryPath("aix", "ppc64"), "/opt/pqdoctor");
  } finally {
    delete process.env.PQDOCTOR_BINARY;
  }
});
