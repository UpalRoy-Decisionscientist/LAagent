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

  let summary = `Prepared conventional commit message for ${state.moduleId}.`;
  if (options.commit) {
    git(["add", "--", ...files]);
    const staged = git(["diff", "--cached", "--name-only"]);
    if (!staged) {
      summary = `No curriculum file changes to commit for ${state.moduleId}.`;
    } else {
      git(["commit", "-m", message]);
      summary = `Created conventional commit for ${state.moduleId}.`;
    }
  }

  basin.post(
    {
      from: "git-release",
      to: "orchestrator",
      gate: "GIT_COMMIT",
      status: "ok",
      summary,
      payload: { message, files },
    },
    "ok",
  );

  return { message, files };
}
