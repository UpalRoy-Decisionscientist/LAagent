import fs from "node:fs";
import path from "node:path";
import type { AgentMessage, BasinState, PipelineGate } from "./types.ts";

const BASIN_DIR = path.join(process.cwd(), "content", "basin");

export class CollaborationBasin {
  constructor(private readonly filePath: string) {}

  static create(moduleId: string): CollaborationBasin {
    fs.mkdirSync(BASIN_DIR, { recursive: true });
    const runId = `${moduleId}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const filePath = path.join(BASIN_DIR, `${runId}.json`);
    const initial: BasinState = {
      runId,
      moduleId,
      sourcePath: "",
      gates: {
        INGEST: "pending",
        GRAPH_AND_PRUNE: "pending",
        PLAYWRIGHT_CAPTURE: "pending",
        RAG_AUDIT: "pending",
        REACT_COMPOSE: "pending",
        GIT_COMMIT: "pending",
      },
      messages: [],
    };
    fs.writeFileSync(filePath, JSON.stringify(initial, null, 2));
    return new CollaborationBasin(filePath);
  }

  static fromFile(filePath: string): CollaborationBasin {
    return new CollaborationBasin(filePath);
  }

  read(): BasinState {
    return JSON.parse(fs.readFileSync(this.filePath, "utf8")) as BasinState;
  }

  update(mutator: (state: BasinState) => void): BasinState {
    const state = this.read();
    mutator(state);
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
    return state;
  }

  post(message: AgentMessage, gateStatus?: "ok" | "warn" | "fail"): BasinState {
    return this.update((state) => {
      state.messages.push(message);
      if (gateStatus) {
        state.gates[message.gate] = gateStatus;
      }
    });
  }

  requireGate(gate: PipelineGate, allowed: Array<"ok" | "warn"> = ["ok", "warn"]): void {
    const status = this.read().gates[gate];
    if (!status || !allowed.includes(status as "ok" | "warn")) {
      throw new Error(`Gate ${gate} is ${status ?? "missing"}; cannot continue.`);
    }
  }

  path(): string {
    return this.filePath;
  }
}

export const PIPELINE_SEQUENCE: PipelineGate[] = [
  "INGEST",
  "GRAPH_AND_PRUNE",
  "PLAYWRIGHT_CAPTURE",
  "RAG_AUDIT",
  "REACT_COMPOSE",
  "GIT_COMMIT",
];
