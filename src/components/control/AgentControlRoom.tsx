import { useEffect, useMemo, useState } from "react";
import { Play, RefreshCw, Shield, Workflow } from "lucide-react";
import type { PipelineGate } from "../../../shared/types.ts";
import { AGENT_CARDS, PIPELINE_PRESETS, gatesThrough, type PipelinePreset } from "../../../shared/presets.ts";

interface ControlRun {
  id: string;
  status: "queued" | "running" | "ok" | "fail";
  events: Array<{ at: string; gate?: PipelineGate; status: string; summary: string }>;
  result?: {
    title?: string;
    rigor?: number;
    assets?: Array<{ slug: string; webpPath: string; caption: string }>;
    steps?: Array<{ title: string; imageSrc: string; academicRigorScore: number }>;
    error?: string;
  };
  error?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return body;
}

export function AgentControlRoom() {
  const [presetId, setPresetId] = useState(PIPELINE_PRESETS[0]?.id ?? "uday-excerpt");
  const [sourcePath, setSourcePath] = useState(PIPELINE_PRESETS[0]?.sourcePath ?? "");
  const [moduleId, setModuleId] = useState(PIPELINE_PRESETS[0]?.moduleId ?? "");
  const [chapters, setChapters] = useState(PIPELINE_PRESETS[0]?.chapters?.join(",") ?? "");
  const [run, setRun] = useState<ControlRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preset = useMemo(
    () => PIPELINE_PRESETS.find((item) => item.id === presetId),
    [presetId],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem("control-run-id");
    if (!stored) return;
    void api<ControlRun>(`/api/runs/${stored}`)
      .then(setRun)
      .catch(() => sessionStorage.removeItem("control-run-id"));
  }, []);

  useEffect(() => {
    if (run?.id) sessionStorage.setItem("control-run-id", run.id);
  }, [run?.id]);

  useEffect(() => {
    if (!run?.id) return;
    if (run.status === "ok" || run.status === "fail") return;
    const timer = window.setInterval(() => {
      void api<ControlRun>(`/api/runs/${run.id}`).then(setRun).catch((err: Error) => setError(err.message));
    }, 600);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.status]);

  const applyPreset = (next: PipelinePreset): void => {
    setPresetId(next.id);
    setSourcePath(next.sourcePath);
    setModuleId(next.moduleId);
    setChapters(next.chapters?.join(",") ?? "");
  };

  const startRun = async (gates?: PipelineGate[]): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const created = await api<ControlRun>("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          presetId,
          sourcePath,
          moduleId,
          chapters: chapters
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          gates,
        }),
      });
      setRun(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const gateStatus = (gate: PipelineGate): string => {
    const events = run?.events.filter((event) => event.gate === gate) ?? [];
    return events.at(-1)?.status ?? "idle";
  };

  const assets = run?.result?.assets ?? run?.result?.steps?.map((step) => ({
    slug: step.title,
    webpPath: step.imageSrc,
    caption: step.title,
  })) ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-orange-400">Multi-agent test console</p>
            <h1 className="text-3xl font-semibold mt-1">Run every curriculum agent</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Start the basin pipeline from this page: ingest → graph → Playwright → Wiki-RAG → compose → git.
              Use a preset or point at a Uday_AWS checkout.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Workflow className="w-4 h-4" />
            <span>{run ? `Run ${run.status}` : "Idle"}</span>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <label className="block text-sm">
              <span className="text-slate-400">Preset</span>
              <select
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5"
                value={presetId}
                onChange={(event) => {
                  const next = PIPELINE_PRESETS.find((item) => item.id === event.target.value);
                  if (next) applyPreset(next);
                }}
              >
                {PIPELINE_PRESETS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-slate-400">{preset?.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-slate-400">Source</span>
                <input
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5"
                  value={sourcePath}
                  onChange={(event) => setSourcePath(event.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-400">Module id</span>
                <input
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5"
                  value={moduleId}
                  onChange={(event) => setModuleId(event.target.value)}
                />
              </label>
            </div>
            <label className="text-sm block">
              <span className="text-slate-400">Chapters (optional)</span>
              <input
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5"
                value={chapters}
                onChange={(event) => setChapters(event.target.value)}
                placeholder="01,02,08"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                data-testid="run-all-agents"
                disabled={busy || run?.status === "running" || run?.status === "queued"}
                onClick={() => void startRun()}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                Run all agents
              </button>
              <button
                type="button"
                onClick={() => setRun(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5"
              >
                <RefreshCw className="w-4 h-4" />
                Reset view
              </button>
            </div>
            {error && <p className="text-rose-400 text-sm">{error}</p>}
          </div>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <Shield className="w-4 h-4" />
              Quality gates
            </div>
            <p className="text-slate-400 text-sm mt-2">
              Later agents refuse to start unless the previous basin gate is ok. Git commit from this UI prepares
              the message; it does not push.
            </p>
            {run?.result?.rigor != null && (
              <p className="mt-4 text-2xl font-semibold">Rigor {run.result.rigor}</p>
            )}
            {run?.result?.title && <p className="text-slate-300 mt-1">{run.result.title}</p>}
          </aside>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AGENT_CARDS.map((agent) => {
            const status = gateStatus(agent.gate);
            return (
              <article key={agent.gate} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{agent.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{agent.gate}</p>
                  </div>
                  <span
                    data-testid={`gate-${agent.gate}`}
                    className={`text-xs rounded-full px-2 py-1 ${
                      status === "ok"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : status === "running"
                          ? "bg-amber-500/20 text-amber-300"
                          : status === "fail"
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <p className="text-sm text-slate-400 flex-1">{agent.mission}</p>
                <button
                  type="button"
                  disabled={busy || run?.status === "running"}
                  onClick={() => void startRun(gatesThrough(agent.gate))}
                  className="text-sm rounded-lg border border-slate-700 px-3 py-2 hover:border-orange-400 disabled:opacity-50"
                >
                  Run through {agent.name}
                </button>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="font-semibold mb-3">Basin log</h2>
          <ol className="space-y-2 text-sm font-mono text-slate-300 max-h-64 overflow-auto">
            {(run?.events ?? []).map((event, index) => (
              <li key={`${event.at}-${index}`}>
                <span className="text-slate-500">{event.gate ?? "system"}</span> · {event.status} · {event.summary}
              </li>
            ))}
            {!run?.events.length && <li className="text-slate-500">No run yet.</li>}
          </ol>
        </section>

        {assets.length > 0 && (
          <section>
            <h2 className="font-semibold mb-3">Captured frames</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assets.map((asset) => (
                <figure key={asset.webpPath} className="rounded-xl overflow-hidden border border-slate-800 bg-black">
                  <img src={asset.webpPath} alt={asset.caption} className="w-full h-auto" />
                  <figcaption className="p-3 text-xs text-slate-400">{asset.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
