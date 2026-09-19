export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type LearnerTrack = "beginner" | "intermediate" | "advanced";

export type PipelineGate =
  | "INGEST"
  | "GRAPH_AND_PRUNE"
  | "PLAYWRIGHT_CAPTURE"
  | "RAG_AUDIT"
  | "REACT_COMPOSE"
  | "GIT_COMMIT";

export interface TechnicalTriplet {
  subject: string;
  action: string;
  target: string;
}

export interface LearningObjective {
  id: string;
  title: string;
  bloom: BloomLevel;
  services: string[];
  prerequisites: string[];
  track: LearnerTrack;
  skipGate?: DiagnosticChallenge;
  triplets: TechnicalTriplet[];
}

export interface DiagnosticChallenge {
  id: string;
  prompt: string;
  expectedSignals: string[];
  passThreshold: number;
}

export interface CaptureStep {
  index: number;
  slug: string;
  title: string;
  description: string;
  caption: string;
  selector?: string;
  route: string;
  highlight?: string;
  cliFallback?: string;
  terraformFallback?: string;
  wellArchitectedPillars: string[];
}

export interface VisualAsset {
  stepIndex: number;
  slug: string;
  webpPath: string;
  width: number;
  height: number;
  bytes: number;
  caption: string;
}

export interface AuditFinding {
  stepIndex: number;
  score: number;
  passed: boolean;
  notes: string[];
  citations: string[];
  hallucinationFlags: string[];
}

export interface LessonStep {
  id: number;
  title: string;
  description: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  alt: string;
  cliFallback?: string;
  terraformFallback?: string;
  auditPassed: boolean;
  academicRigorScore: number;
  citations: string[];
}

export interface CourseManifest {
  moduleId: string;
  title: string;
  summary: string;
  services: string[];
  tracks: LearnerTrack[];
  objectives: LearningObjective[];
  steps: LessonStep[];
  skipGates: DiagnosticChallenge[];
  academicRigorScore: number;
  generatedAt: string;
}

export interface AgentMessage {
  from: string;
  to: string;
  gate: PipelineGate;
  status: "ok" | "warn" | "fail";
  summary: string;
  payload?: Record<string, unknown>;
}

export interface BasinState {
  runId: string;
  moduleId: string;
  sourcePath: string;
  gates: Partial<Record<PipelineGate, "pending" | "ok" | "warn" | "fail">>;
  messages: AgentMessage[];
  rawText?: string;
  triplets?: TechnicalTriplet[];
  objectives?: LearningObjective[];
  capturePlan?: CaptureStep[];
  assets?: VisualAsset[];
  audits?: AuditFinding[];
  skipGates?: DiagnosticChallenge[];
  courseTitle?: string;
  courseSummary?: string;
  manifest?: CourseManifest;
  composedFiles?: string[];
}
