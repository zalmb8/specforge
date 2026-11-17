---
specforge: 1
id: gate-probe-2
title: Docs-only gate probe
status: done
depends_on: []
acceptance:
  - id: AC-1
    text: "docs/gate-probe.txt exists."
    verify: "test -f docs/gate-probe.txt"
---

## Summary

Throwaway spec that exercises a docs-only build/ PR through the self-hosted gate.

## Context

Acceptance test for self-hosting; to be archived after the release.

## Open questions

## Design

Add `docs/gate-probe.txt`.

## Out of scope

Everything else.
