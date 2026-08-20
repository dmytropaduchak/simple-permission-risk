import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { scanWorkflowPermissions, type Finding } from "./rules";

const MARKER = "<!-- simple-permission-risk -->";
const NAME = "Simple Permission Risk";

function listWorkflowFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"))
    .map((n) => path.join(dir, n));
}

function formatFindings(findings: Finding[]): string {
  if (!findings.length) {
    return [MARKER, `## ${NAME}`, "", "No overly broad workflow permissions found."].join("\n");
  }
  const rows = findings
    .map((f) => `| ${f.severity} | \`${f.ruleId}\` | ${f.line ? `${f.file}:${f.line}` : f.file} | ${f.title} |`)
    .join("\n");
  return [
    MARKER,
    `## ${NAME}`,
    "",
    `Found **${findings.length}** issue(s).`,
    "",
    "| Severity | Rule | Location | Detail |",
    "| --- | --- | --- | --- |",
    rows,
  ].join("\n");
}

async function upsertPrComment(token: string, body: string): Promise<void> {
  const { context } = github;
  if (context.eventName !== "pull_request" && context.eventName !== "pull_request_target") return;
  const issue_number = context.payload.pull_request?.number;
  if (!issue_number) return;
  const octokit = github.getOctokit(token);
  const { data: comments } = await octokit.rest.issues.listComments({ ...context.repo, issue_number });
  const existing = comments.find((c) => c.body?.includes(MARKER));
  if (existing) {
    await octokit.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
    return;
  }
  await octokit.rest.issues.createComment({ ...context.repo, issue_number, body });
}

async function run(): Promise<void> {
  const token = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
  const failOn = (core.getInput("fail-on") || "none").toLowerCase();
  const workflowPath = core.getInput("workflow-path") || ".github/workflows";
  const files = listWorkflowFiles(workflowPath);
  const findings: Finding[] = [];
  for (const file of files) findings.push(...scanWorkflowPermissions(file, fs.readFileSync(file, "utf8")));
  const summary = formatFindings(findings);
  await core.summary.addRaw(summary, true).write();
  for (const f of findings) {
    const msg = `${f.title} (${f.ruleId})`;
    if (f.severity === "high") core.error(msg, { file: f.file, startLine: f.line });
    else core.warning(msg, { file: f.file, startLine: f.line });
  }
  if (token) {
    try {
      await upsertPrComment(token, summary);
    } catch (e) {
      core.warning(`Could not post PR comment: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  core.setOutput("finding-count", String(findings.length));
  const shouldFail =
    failOn === "high"
      ? findings.some((f) => f.severity === "high")
      : failOn === "medium"
        ? findings.some((f) => f.severity === "high" || f.severity === "medium")
        : false;
  if (shouldFail) core.setFailed(`simple-permission-risk: ${findings.length} finding(s)`);
  else core.info(`Done. ${findings.length} finding(s).`);
}

run().catch((e) => core.setFailed(e instanceof Error ? e.message : String(e)));
