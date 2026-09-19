import { describe, expect, it } from "vitest";
import { startControlPlaneServer } from "../scripts/control-plane-server.ts";

describe("agent control plane", () => {
  it("exposes presets and runs ingest + graph against the Uday excerpt", async () => {
    const server = await startControlPlaneServer(0);
    try {
      const presets = await fetch(`${server.origin}/api/presets`).then((response) => response.json());
      expect(presets.agents).toHaveLength(6);
      expect(presets.presets.some((item: { id: string }) => item.id === "tf-cloud-agents")).toBe(true);

      const aws = await fetch(`${server.origin}/api/aws-access`).then((response) => response.json());
      expect(aws.source).toContain("terraform-aws-tf-cloud-agents");
      expect(aws.mode).toBe("dry-run");

      const tfc = await fetch(`${server.origin}/api/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presetId: "tf-cloud-agents" }),
      });
      expect(tfc.status).toBe(202);
      const tfcRun = (await tfc.json()) as { id: string };
      let tfcStatus = { status: "queued", result: { mode: "" } as { mode?: string } };
      for (let attempt = 0; attempt < 40; attempt += 1) {
        tfcStatus = (await fetch(`${server.origin}/api/runs/${tfcRun.id}`).then((response) =>
          response.json(),
        )) as typeof tfcStatus;
        if (tfcStatus.status === "ok" || tfcStatus.status === "fail") break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(tfcStatus.status).toBe("ok");
      expect(tfcStatus.result.mode).toBe("dry-run");

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
