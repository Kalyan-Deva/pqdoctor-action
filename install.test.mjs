// node --test action/pqdoctor/install.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("the right asset per runner", async () => {
  const { assetFor } = await import("./install.mjs");
  assert.equal(assetFor("0.3.0", "linux", "x64").file, "pqdoctor-0.3.0-linux-x64.tar.gz");
  assert.equal(assetFor("0.3.0", "linux", "arm64").bin, "pqdoctor-0.3.0-linux-arm64/pqdoctor");
  assert.equal(assetFor("0.3.0", "darwin", "arm64").file, "pqdoctor-0.3.0-macos-universal.tar.gz");
  assert.equal(assetFor("0.3.0", "win32", "x64").file, "pqdoctor-0.3.0-windows-x64.exe");
  assert.throws(() => assetFor("0.3.0", "aix", "ppc64"));
});

test("SHA256SUMS lines", async () => {
  const { sumFor } = await import("./install.mjs");
  const s = `${"a".repeat(64)}  pqdoctor-0.3.0-linux-x64.tar.gz\n${"B".repeat(64)} *pqdoctor-0.3.0-windows-x64.exe\n`;
  assert.equal(sumFor(s, "pqdoctor-0.3.0-windows-x64.exe"), "b".repeat(64));
  assert.equal(sumFor(s, "missing"), null);
});

test("installs only what matches the published checksum", async () => {
  const good = Buffer.from("pretend binary");
  let serve = good;
  const file = (await import("./install.mjs")).assetFor("9.9.9").file;
  const sums = `${createHash("sha256").update(good).digest("hex")}  ${file}\n`;
  const srv = createServer((req, res) => {
    if (req.url.endsWith("/SHA256SUMS.txt")) return res.end(sums);
    if (req.url.endsWith(`/${file}`)) return res.end(serve);
    res.statusCode = 404;
    res.end();
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  process.env.PQDOCTOR_DOWNLOAD_BASE = `http://127.0.0.1:${srv.address().port}`;
  const { install } = await import(`./install.mjs?base=${Date.now()}`);
  try {
    if (file.endsWith(".exe")) {
      const bin = await install("9.9.9", mkdtempSync(join(tmpdir(), "pqa-")));
      assert.deepEqual(readFileSync(bin), good);
    }
    serve = Buffer.from("tampered binary");
    await assert.rejects(install("9.9.9", mkdtempSync(join(tmpdir(), "pqa-"))), /checksum mismatch/);
    await assert.rejects(install("1.2", "x"), /version must look like/);
    await assert.rejects(install("8.8.8", mkdtempSync(join(tmpdir(), "pqa-"))), /isn't listed/);
  } finally {
    srv.close();
  }
});
