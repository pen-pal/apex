# Security Policy

## Scope

Apex is a **fully static, client-side** educational app — no backend, no accounts, no user data, and no server to
attack. It runs entirely in the browser and can run offline. The cryptography and security sections are **teaching
models**: they operate on sandbox values only, use published test vectors, and never touch real key material or claim
to decrypt real captured traffic.

Because of that, the realistic security surface is small and is limited to things like:

- A cross-site-scripting or content-injection bug in the app itself.
- A vulnerable third-party dependency.
- A build/supply-chain issue in the published GitHub Pages bundle.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Instead, either:

- Use GitHub's **private vulnerability reporting** (Security → *Report a vulnerability*) on this repository, or
- Email **unameme@protonmail.com** with a description and, if possible, steps to reproduce.

You can expect an initial acknowledgement within a few days. Once a fix is prepared and released, we're happy to credit
you unless you prefer to remain anonymous.

## Not in scope

- The intentional "attack" and "break" interactions inside the learning sections (SSRF, padding oracles, traffic
  correlation, firewall bypass, etc.) are **educational simulations** on in-app sandbox data — they are the point of
  the app, not vulnerabilities.
- Findings that require a modified local build or that only affect a browser/OS out of support.
