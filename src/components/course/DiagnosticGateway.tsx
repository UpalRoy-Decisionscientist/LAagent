import { useMemo, useState } from "react";
import type { DiagnosticChallenge } from "../../../shared/types.ts";

export function DiagnosticGateway({ challenges }: { challenges: DiagnosticChallenge[] }) {
  const challenge = challenges[0];
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const hits = useMemo(() => {
    const lower = answer.toLowerCase();
    return challenge?.expectedSignals.filter((signal) => lower.includes(signal.toLowerCase())) ?? [];
  }, [answer, challenge]);

  if (!challenge) return null;
  const passed = hits.length >= challenge.passThreshold;

  return (
    <section className="mx-auto max-w-7xl px-6 pb-16">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Skip-gate diagnostic</h2>
        <p className="text-sm text-slate-600 mt-2">{challenge.prompt}</p>
        <textarea
          className="mt-4 w-full min-h-32 rounded-lg border border-slate-300 p-3 text-sm"
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setSubmitted(false);
          }}
          placeholder="Write your endpoint policy reasoning here"
        />
        <button
          type="button"
          className="mt-3 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => setSubmitted(true)}
        >
          Evaluate skip gate
        </button>
        {submitted && (
          <p className={`mt-3 text-sm ${passed ? "text-emerald-700" : "text-amber-700"}`}>
            {passed
              ? "You may skip the prerequisite module and continue at the advanced lab."
              : `Need ${challenge.passThreshold - hits.length} more required signal(s): ${challenge.expectedSignals.join(", ")}.`}
          </p>
        )}
      </div>
    </section>
  );
}
