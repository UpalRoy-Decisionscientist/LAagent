import { AwsInteractiveLesson } from "./components/course/AwsInteractiveLesson.tsx";
import { DiagnosticGateway } from "./components/course/DiagnosticGateway.tsx";
import { activeModule } from "./generated/activeModule.ts";

export default function App() {
  return (
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
  );
}
