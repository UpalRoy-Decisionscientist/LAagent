import { execFileSync } from "node:child_process";
import { localBin } from "../shared/process.ts";

const tsx = localBin("tsx");

const stages: Array<{ name: string; args: string[] }> = [
  { name: "HCP Terraform AWS agents", args: ["scripts/run-tf-cloud-agents.ts"] },
  {
    name: "s3-vpc pipeline",
    args: [
      "scripts/run-pipeline.ts",
      "--source",
      "materials/s3-vpc-lab.md",
      "--module",
      "s3-vpc-private-access",
    ],
  },
  { name: "Uday AWS agents + lesson UI", args: ["scripts/e2e-uday-aws.ts"] },
  { name: "agent control room", args: ["scripts/verify-control-room.ts"] },
];

for (const stage of stages) {
  console.log(`\n== e2e: ${stage.name} ==`);
  execFileSync(tsx, stage.args, { stdio: "inherit", env: process.env });
}

console.log("\ne2e: all pipeline stages passed");
