import { describe, expect, it } from "vitest";
import { startControlPlaneServer } from "../scripts/control-plane-server.ts";

describe("agent control plane", () => {
  it("exposes presets and runs ingest + graph against the Uday excerpt", async () => {
    const server = await startControlPlaneServer(0);
    try {
      const presets = await fetch(`${server.origin}/api/presets`).then((response) => response.json());
      expect(presets.agents).toHaveLength(6);

      const created = await fetch(`${server.origin}/api/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presetId: "uday-excerpt",
          gates: ["INGEST", "GRAPH_AND_PRUNE"],
        }),
      });
      expect(created.status).toBe(202);
      const run = (await created.json()) as { id: string };
      let current = { status: "queued", result: { title: "" } as { title?: string } };
      for (let attempt = 0; attempt < 40; attempt += 1) {
        current = (await fetch(`${server.origin}/api/runs/${run.id}`).then((response) =>
          response.json(),
        )) as typeof current;
        if (current.status === "ok" || current.status === "fail") break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(current.status).toBe("ok");
      expect(current.result.title).toMatch(/IAM/i);
    } finally {
      await server.close();
    }
  }, 20_000);
});
