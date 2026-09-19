import { execFileSync } from "node:child_process";
import type { CollaborationBasin } from "../shared/basin.ts";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function runGitReleaseAgent(
  basin: CollaborationBasin,
  options: { commit?: boolean } = {},
): { message: string; files: string[] } {
  basin.requireGate("REACT_COMPOSE");
  const state = basin.read();
  const message = `feat(curriculum): complete ${state.moduleId} with automated visual steps`;
  const files = [
    "content/modules",
    "public/assets/course",
    "src/components/course",
    "src/generated",
    "scripts",
    "agents",
    "knowledge",
    "materials",
  ];

  if (options.commit) {
    git(["add", ...files]);
    git(["commit", "-m", message]);
  }

  basin.post(
    {
      from: "git-release",
      to: "orchestrator",
      gate: "GIT_COMMIT",
      status: "ok",
      summary: options.commit
        ? `Created conventional commit for ${state.moduleId}.`
        : `Prepared conventional commit message for ${state.moduleId}.`,
      payload: { message, files },
    },
    "ok",
  );

  return { message, files };
}
