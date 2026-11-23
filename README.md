# pqdoctor GitHub Action

Post-quantum TLS checks in CI: which of your hosts negotiate hybrid ML-KEM (X25519MLKEM768), **why the rest don't** — a config change, a TLS library that can't, or a provider's product — with the fix; ML-DSA certificate readiness; SARIF for code scanning; regressions since the last run; and an optional push to a [pqdoctor fleet](https://pqdoctor.com/pqdoctor/guides/enterprise/) dashboard.

Current release: **v1.1.2** (`@v1`), which installs pqdoctor **0.5.1** from npm by default. Tested on `ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-15` and `windows-2022` runners.

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

## Inputs

| Input | Default | |
|---|---|---|
| `hosts` | | one per line or comma-separated: `host`, `host:port`, `[v6]:port`, or `ssh://host[:port]` for an SSH server; `#` starts a comment |
| `hosts-file` | | more hosts from a file in the same format (e.g. from `pqdoctor inventory`) |
| `fail-on` | `not-pq` | `not-pq`: fail when a host answers but isn't post-quantum. `not-pq-or-unreachable`: unreachable fails too. `regression`: fail only when a host that was post-quantum in the last run isn't now. `never`: report only |
| `fingerprint` | `true` | for hosts that aren't post-quantum, say why one level down: config, library or provider |
| `certificates` | `true` | also read each TLS host's certificate chain: does it serve ML-DSA, and would the chain still fit the first flight with ML-DSA (2 more connections a host) |
| `version` | `0.5.1` | the pqdoctor version to install (`x.y.z`) |
| `install` | `npm` | the prebuilt binary from the [`pqdoctor`](https://www.npmjs.com/package/pqdoctor) npm package (`release` is accepted as the old name) |
| `upload-sarif` | `false` | upload the SARIF to code scanning (needs `security-events: write`) |
| `comment` | `false` | on a pull request, one comment with the results, updated on re-runs (needs `pull-requests: write`) |
| `fleet-url`, `fleet-token` | | push the run and its leverage plan to a pqdoctor fleet (pass the ingest token as a secret); both are needed |
| `owners` | | an `owners.toml` mapping hosts to teams, sent with the fleet push |
| `github-token` | `${{ github.token }}` | the token for the pull request comment |

## Outputs

| Output | |
|---|---|
| `pq` | how many hosts negotiate post-quantum key exchange |
| `total` | how many hosts were checked |
| `regressions` | how many hosts were post-quantum in the last run and aren't now |
| `report` | path to a JSON file with every host's report |
| `results` | path to the scan records (JSONL), for `pqdoctor diff`, `plan`, `tickets` or `push` |
| `sarif` | path to the SARIF file (empty when only SSH hosts were checked) |

## How it runs

- **TLS hosts** go through one `pqdoctor scan`, gently: 2 hosts at a time, at most 2 new hosts a second, handshake-only probes. It writes SARIF and the JSONL records. **SSH hosts** (`ssh://`) are checked one at a time with `pqdoctor ssh`.
- **The job summary** has a table of every host (key exchange, result, cause) and the fixes for the ones that aren't post-quantum. Failing hosts are annotated as errors, unreachable ones as warnings.
- **A `mixed` host** answers post-quantum on some connections and not on others (often a provider mid-rollout). The summary says so. For `fail-on` it counts as not post-quantum.
- **Regressions:** the last run's TLS records are kept in the Actions cache (one entry per repository and `hosts-file`). `pqdoctor diff` compares like for like, and every regression is annotated. Only `fail-on: regression` fails the job on them. SSH hosts aren't compared.
- **Fleet:** with `fleet-url` and `fleet-token`, the TLS records are pushed with `pqdoctor push --with-plan`, with source `action:<owner>/<repo>`. A failed push is a warning, not a failure.

## Where pqdoctor comes from

pqdoctor is distributed only through npm. `install: npm` runs `npm install pqdoctor@<version>`, which brings the launcher and the one platform package with the binary for the runner (`@pqdoctor/linux-x64`, `@pqdoctor/linux-arm64`, `@pqdoctor/darwin-universal`, `@pqdoctor/win32-x64`); npm checks each tarball against the registry's integrity hash. pqdoctor itself is free to use but closed source; this action (the scripts in this repository) is MIT licensed.

Tests: `node --test run.test.mjs install.test.mjs`. The `test` workflow runs them, then the action itself against live hosts on the four runners above.
