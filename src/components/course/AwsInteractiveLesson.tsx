import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, ShieldCheck, Terminal, Layers } from "lucide-react";
import type { LessonStep } from "../../../shared/types.ts";
import { ConsoleSnapshot } from "./ConsoleSnapshot.tsx";

interface Props {
  title: string;
  summary: string;
  rigor: number;
  services: string[];
  steps: LessonStep[];
}

export function AwsInteractiveLesson({ title, summary, rigor, services, steps }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const current = steps[activeStep];
  const passed = useMemo(() => steps.filter((step) => step.auditPassed).length, [steps]);

  if (!current) {
    return <p className="p-8">No audited steps available.</p>;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-6 self-start">
        <header>
          <span className="text-xs font-semibold tracking-wider text-blue-700 uppercase">
            AWS Academy Certified Guide
          </span>
          <h1 data-testid="lesson-title" className="text-2xl font-bold text-slate-900 mt-1">
            {title}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {services.map((service) => (
              <span
                key={service}
                className="text-xs bg-slate-900 text-white px-2 py-1 rounded-full"
              >
                {service}
              </span>
            ))}
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-1 rounded-full">
              Rigor {rigor} · {passed}/{steps.length} steps audited
            </span>
          </div>
        </header>

        <nav className="space-y-2" aria-label="Lesson steps">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              data-testid="lesson-step"
              onClick={() => setActiveStep(idx)}
              className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-center justify-between ${
                activeStep === idx
                  ? "border-blue-600 bg-blue-50 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    activeStep === idx ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-slate-800">{step.title}</span>
              </div>
              {step.auditPassed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-white rounded-lg border border-slate-200 text-sm">
          <h2 className="font-semibold text-slate-900 mb-2">Step walkthrough</h2>
          <p className="text-slate-600 leading-relaxed mb-4">{current.description}</p>

          {current.cliFallback && (
            <div className="bg-slate-950 text-slate-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <div className="flex items-center gap-2 text-slate-400 mb-1 border-b border-slate-700 pb-1">
                <Terminal className="w-3.5 h-3.5" />
                <span>CLI alternative</span>
              </div>
              <code>{current.cliFallback}</code>
            </div>
          )}

          {current.terraformFallback && (
            <div className="mt-3 bg-slate-950 text-slate-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <div className="flex items-center gap-2 text-slate-400 mb-1 border-b border-slate-700 pb-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Terraform fragment</span>
              </div>
              <code>{current.terraformFallback}</code>
            </div>
          )}

          <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>
              Wiki-RAG score {current.academicRigorScore} · Well-Architected citations attached
            </span>
          </div>
          <ul className="mt-2 text-xs text-blue-700 list-disc pl-4">
            {current.citations.map((citation) => (
              <li key={citation}>
                <a href={citation} className="underline" target="_blank" rel="noreferrer">
                  {citation}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-7">
        <ConsoleSnapshot step={current} />
      </div>
    </div>
  );
}
