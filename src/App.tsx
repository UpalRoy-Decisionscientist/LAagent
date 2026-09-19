import { useState } from "react";
import { AwsInteractiveLesson } from "./components/course/AwsInteractiveLesson.tsx";
import { DiagnosticGateway } from "./components/course/DiagnosticGateway.tsx";
import { AgentControlRoom } from "./components/control/AgentControlRoom.tsx";
import { activeModule } from "./generated/activeModule.ts";

export default function App() {
  const [view, setView] = useState<"control" | "lesson">("control");

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-20 flex gap-2 border-b border-slate-800 bg-slate-950/95 px-6 py-3 text-sm">
        <button
          type="button"
          data-testid="nav-control"
          onClick={() => setView("control")}
          className={`rounded-md px-3 py-1.5 ${view === "control" ? "bg-orange-500 text-slate-950 font-semibold" : "text-slate-200"}`}
        >
          Agent test UI
        </button>
        <button
          type="button"
          data-testid="nav-lesson"
          onClick={() => setView("lesson")}
          className={`rounded-md px-3 py-1.5 ${view === "lesson" ? "bg-orange-500 text-slate-950 font-semibold" : "text-slate-200"}`}
        >
          Lesson preview
        </button>
      </nav>
      {view === "control" ? (
        <AgentControlRoom />
      ) : (
        <div className="min-h-screen bg-slate-50">
          <AwsInteractiveLesson
            title={activeModule.title}
            summary={activeModule.summary}
            rigor={activeModule.academicRigorScore}
            services={activeModule.services}
            steps={activeModule.steps}
          />
          <DiagnosticGateway challenges={activeModule.skipGates} />
        </div>
      )}
    </div>
  );
}
