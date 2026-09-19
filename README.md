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
| HCP Terraform AWS agents | `agents/aws-tf-cloud-agents.ts`, `terraform/tf-cloud-agents/` | aws-ia/tf-cloud-agents on ECS Fargate | IAM task role; no console passwords |

The default hands-on path is a **high-fidelity AWS Console replica** so Cursor Cloud / CI can capture publication-grade images without operator credentials. Operators who already have a logged-in Playwright `storageState` may set `AWS_STORAGE_STATE` and point routes at their own session.

Live AWS API access uses the [AWS IA Terraform Cloud agents](https://github.com/aws-ia/terraform-aws-tf-cloud-agents) stack (vendored under `terraform/vendor/terraform-aws-tf-cloud-agents`). Agents run on ECS Fargate with an IAM **task role** (`ReadOnlyAccess` by default) and poll HCP Terraform — no console password and no long-lived access keys in the curriculum pipeline.

```bash
npm run aws:agents
```

That writes validated `terraform.tfvars.json` from `AWS_PROFILE` / `AWS_VPC_ID` / `TFC_ORG_NAME`. Set `AWS_TF_AGENTS_APPLY=1` plus `TFC_TOKEN` only in an operator-owned account to `terraform apply`. The Agent test UI preset **HCP Terraform AWS agents** runs the same dry-run.

## Queue execution

```bash
npm test
npm run e2e
```

`npm run e2e` is the end-to-end path: S3/VPC pipeline, Uday chapter ingest through every basin gate, lesson-preview verification, then the agent test UI.

`e2e:uday` ingests [Uday_AWS](https://github.com/DeeptiShuklaProject/Uday_AWS) chapters and runs every agent gate, then checks the lesson walkthrough.

`e2e:uday:console` (also covered by `npm test`) is the Playwright **IAM login** test for Uday Module 08 Lab 1 (`enterprise-image-processor`): it reaches live `console.aws.amazon.com`, then signs in as an IAM user (root disabled) and captures the create-function / success / CloudWatch frames. Live authenticated sessions require operator-owned `AWS_CONSOLE_*` plus `AWS_E2E_LIVE=1`; CI uses the lab replica login.

Open the test UI (API + Vite together):

```bash
npm run lab
```

Then visit http://127.0.0.1:5173 — **Agent test UI** runs ingestion, knowledge graph, Playwright, Wiki-RAG, composer, and git release. **Lesson preview** shows the last composed module.

