import { runTfCloudAgents } from "../agents/aws-tf-cloud-agents.ts";

const report = runTfCloudAgents();
console.log(JSON.stringify(report, null, 2));
if (report.validationErrors.length && process.env.AWS_TF_AGENTS_APPLY === "1") {
  process.exit(1);
}
