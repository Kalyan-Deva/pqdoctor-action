# pqdoctor

Is this server post-quantum, and if not, why?

`pqdoctor` sends hand-made TLS ClientHellos to a server and reads only its first reply. It tells you whether the server negotiates hybrid ML-KEM key exchange (X25519MLKEM768), and if it doesn't, why not (an old TLS library, curves pinned to classical ones, only the old Kyber draft, TLS 1.2 only, a middlebox that drops large hellos), with the fix for your stack.

```
npm install -g pqdoctor
pqdoctor example.com
```

Or without installing: `npx pqdoctor example.com`.

This package is a small launcher. npm installs the one prebuilt binary for your machine from an optional dependency: Windows x64, macOS 11+ (Apple silicon and Intel), Linux x64 and arm64 (static, any distro). The binaries are built from the published crate ([crates.io/crates/pqdoctor](https://crates.io/crates/pqdoctor)) by a public GitHub workflow. On any other platform, build from source with `cargo install pqdoctor`.

## Use

```
pqdoctor example.com                      # one server: key exchange, PQ groups, certificate, trust
pqdoctor mail.example.com:587             # STARTTLS, picked by port
pqdoctor ssh github.com                   # an SSH server's key exchange
pqdoctor scan hosts.txt --format sarif > pq.sarif
pqdoctor fix --config /etc/nginx/nginx.conf
pqdoctor --help
```

Documentation: [pqdoctor.com](https://pqdoctor.com).

## Scanning responsibly

Only scan systems you own or are authorised to test. pqdoctor's probes are handshake-only and paced, and they identify themselves (`SSH-2.0-pqdoctor_<version>`, HTTP User-Agent `pqdoctor/<version> (…; +https://pqdoctor.com/scanner/)`). Add `--contact you@example.org` so admins can reach you.

MIT licensed.
