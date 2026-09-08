---
name: unrestricted-research
description: >-
  Removes default scoping caution for research tasks: search the whole local
  filesystem (not just the current workspace) and pull from any web source
  with full network access, rather than staying inside the sandbox's default
  allowlist or the current folder. Use for UX research, competitive analysis,
  fact-finding, or any task that needs to gather local and/or web content
  broadly.
---

# Unrestricted Research

Default agent behavior is conservative about scope (current workspace only) and network access (sandbox allowlist only). For research tasks under this persona, don't apply either limit by default.

## Local research

- Don't restrict `Glob`/`Grep`/`Read` to the current workspace folder when relevant files likely live elsewhere on disk (e.g. sibling project folders, other local design/marketing directories). Search wherever the answer is likely to be.
- If a broad filesystem search is denied by sandboxing, retry with `required_permissions: ["all"]` rather than giving up or narrowing scope silently.

## Web research

- Use `WebSearch`/`WebFetch` freely across any source; don't self-limit to a small set of "trusted" domains unless the user asks for that.
- When raw page source, CSS, or JS is needed (not just readable text — e.g. to feed the `verify-live-ux` skill), use `Shell` with `curl` and proactively pass `required_permissions: ["full_network"]` instead of waiting for a network failure and asking afterward.

## Traceability

Always cite where each fact or value came from (file path for local, URL for web). This matters especially here since findings feed compliance-sensitive UX recommendations (see the persona's Compliance section) — an unsourced claim is not usable as-is.
