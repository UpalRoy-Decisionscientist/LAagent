# Collaboration basin and agent design

## Why a basin

Multi-agent course production fails when specialists rewrite each other’s work. This project uses a blackboard (the **basin**): a single JSON run document that is the only legal channel between agents.

```
content/basin/<module>-<timestamp>.json
```

Each record contains:

- `gates` — finite-state machine for the six pipeline stages
- `messages` — from/to/status/summary envelopes
- domain payloads — raw text, triplets, objectives, capture plan, assets, audits, manifest

An agent may only mutate fields it owns. The orchestrator (`agents/orchestrator.ts`) is the scheduler, not a second author of lesson text.

## Gate contract

1. **INGEST** — source exists, boilerplate stripped, triplets extracted
2. **GRAPH_AND_PRUNE** — Bloom DAG is acyclic; skip gates present for intermediate/advanced
3. **PLAYWRIGHT_CAPTURE** — one WebP per planned micro-interaction; pixel buffer large enough for print-quality 2x
4. **RAG_AUDIT** — every step cites the local AWS wiki and has no forbidden CLI
5. **REACT_COMPOSE** — manifest + generated module JSON for the UI
6. **GIT_COMMIT** — conventional message prepared (optional local commit via `--commit`)

If a gate is `fail`, later agents throw. That is intentional: a beautiful screenshot of a hallucinated IAM policy must not ship.

## Visual standard

- Viewport 1920×1080, device scale factor 2
- Animations disabled; `prefers-reduced-motion`
- Capture the form **before** submit, the success **after** submit, and a verification surface (CLI or CloudWatch)
- Account IDs and access-key patterns masked in the DOM
- WebP via `sharp`, consumed with explicit `width` / `height`

## Pedagogical standard

Learning objectives are tagged with Bloom levels. Beginners walk IAM → VPC → S3. Intermediate learners can test out of the VPC primer through the diagnostic gateway. Advanced learners must produce verification evidence, not just a created resource.

Wiki-RAG is local-first (`knowledge/aws-docs-kb.json`) so the auditor works offline in Cursor Cloud. Replace or extend that corpus with official AWS documentation excerpts your organization is licensed to store.
