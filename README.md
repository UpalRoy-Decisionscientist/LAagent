# AWS Academy multi-agent course builder

Forward-deployed curriculum engine that turns lab sources into an audited, visual React course.

## Topology

```
                 [ ORCHESTRATOR / BASIN ]
                          │
     ┌────────────────────┼────────────────────┐
     ▼                    ▼                    ▼
[ INGESTION ]     [ PLAYWRIGHT RUNNER ]  [ WIKI-RAG AUDITOR ]
     │                    │                    │
     └────────────────────┼────────────────────┘
                          ▼
              [ REACT COURSE COMPOSER ]
                          ▼
              [ GIT RELEASE CONTROLLER ]
```

Agents never share hidden memory. They read and write a **collaboration basin** JSON document (`content/basin/<run>.json`). Downstream agents refuse to start unless the previous gate is `ok` or `warn`.

| Agent | Code | Tools | Quality bar |
| --- | --- | --- | --- |
| Ingestion & KG sentinel | `agents/ingestion.ts`, `agents/knowledge-graph.ts` | mammoth, triplet prune, Bloom DAG | Token bloat stripped; acyclic prerequisites |
| Playwright automator | `scripts/playwright-recorder.ts` | Chromium 1920×1080 @ 2x, sharp WebP | Multi-frame captures; DOM redaction |
| Pedagogical auditor | `agents/auditor.ts` | BM25 over `knowledge/aws-docs-kb.json` | Rigor ≥ 70; no access-key labs |
| Course composer | `agents/composer.ts`, `src/components/course/` | React, Tailwind, lucide-react | CLS-safe `<picture>`, skip-gate quiz |
| Git release | `agents/git-release.ts` | Git CLI | Conventional curriculum commit |

The default hands-on path is a **high-fidelity AWS Console replica** so Cursor Cloud / CI can capture publication-grade images without operator credentials. Operators who already have a logged-in Playwright `storageState` may set `AWS_STORAGE_STATE` and point routes at their own session.

## Queue execution

```bash
npm run e2e:uday
npm run e2e:uday:console
```

`e2e:uday` ingests [Uday_AWS](https://github.com/DeeptiShuklaProject/Uday_AWS) chapters and runs every agent gate.

`e2e:uday:console` is the Playwright **IAM login** test for Uday Module 08 Lab 1 (`enterprise-image-processor`): it reaches live `console.aws.amazon.com`, then signs in as an IAM user (root disabled) and captures the create-function / success / CloudWatch frames. Live authenticated sessions require operator-owned `AWS_CONSOLE_*` plus `AWS_E2E_LIVE=1`; CI uses the lab replica login.

Master prompt: `.cursorrules` and `docs/MASTER_PROMPT.md`.
