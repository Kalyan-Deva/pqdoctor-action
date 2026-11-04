# pqdoctor GitHub Action

Post-quantum TLS checks in CI: which of your hosts negotiate hybrid ML-KEM (X25519MLKEM768), **why the rest don't** — a config change, a TLS library that can't, or a provider's product — with the fix; SARIF for code scanning; regressions since the last run; and an optional push to a [pqdoctor fleet](https://pqdoctor.com/pqdoctor/guides/enterprise/) dashboard.

```yaml
name: post-quantum
on:
  schedule: [{ cron: "17 6 * * *" }]   # every morning
  pull_request:
permissions:
  contents: read
  security-events: write   # upload-sarif
  pull-requests: write     # comment
jobs:
  pq:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: Kalyan-Deva/pqdoctor-action@v1
        with:
          hosts-file: pq/hosts.txt          # e.g. from `pqdoctor inventory ct:example.com zone:…`
          hosts: ssh://github.com
          fail-on: regression                # fail only when something that was PQ stops being PQ
          upload-sarif: true
          comment: true
          fleet-url: https://fleet.example.com
          fleet-token: ${{ secrets.PQDOCTOR_FLEET_TOKEN }}
          owners: pq/owners.toml
```

| Input | Default | |
|---|---|---|
| `hosts` | | one per line or comma-separated; `host`, `host:port`, `ssh://host` |
| `hosts-file` | | more hosts from a file (`#` comments) |
| `fail-on` | `not-pq` | `not-pq`, `not-pq-or-unreachable`, `regression`, `never` |
| `fingerprint` | `true` | config / library / provider for non-PQ hosts |
| `certificates` | `true` | each TLS host's chain: does it serve ML-DSA, and would the chain still fit the first flight with it |
| `version` | `0.4.0` | the pqdoctor version to install |
| `install` | `npm` | `npm`: the prebuilt binary from the [`pqdoctor`](https://www.npmjs.com/package/pqdoctor) npm package (`release` is accepted as the old name); `source`: build that version from crates.io with cargo (Rust 1.85+) |
| `upload-sarif` | `false` | upload to code scanning (`security-events: write`) |
| `comment` | `false` | one PR comment, updated on re-runs (`pull-requests: write`) |
| `fleet-url`, `fleet-token`, `owners` | | push the run, its leverage plan and teams to a fleet |

Outputs: `pq`, `total`, `regressions`, `report` (JSON), `results` (JSONL, for `pqdoctor diff / plan / tickets / push`), `sarif`.

The last run's records are kept in the Actions cache, so `fail-on: regression` compares like for like. TLS hosts are scanned gently (2 at a time, at most 2 new connections a second, handshake-only); SSH hosts one at a time.

## How the binaries are built

pqdoctor is distributed only through npm and crates.io. `install: npm` runs `npm install pqdoctor@<version>`, which brings the launcher and the one platform package with the binary for the runner (`@pqdoctor/linux-x64`, `@pqdoctor/linux-arm64`, `@pqdoctor/darwin-universal`, `@pqdoctor/win32-x64`); npm checks each tarball against the registry's integrity hash. Those binaries are built by this repository's `build` workflow from the published crate (`cargo install pqdoctor --version <v> --locked`: Linux static musl, macOS universal, Windows x64), each with a build provenance attestation, and published to npm with provenance, so anyone can trace a binary back to the crates.io source and this workflow run.

Tests: `node --test run.test.mjs install.test.mjs npm/launcher.test.mjs`; the `test` workflow runs the action itself against live hosts.
