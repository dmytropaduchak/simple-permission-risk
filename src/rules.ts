export type Severity = "high" | "medium" | "low";
export type Finding = {
  ruleId: string;
  severity: Severity;
  title: string;
  detail: string;
  file: string;
  line?: number;
};

function lineOf(content: string, re: RegExp): number | undefined {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  return undefined;
}

export function scanWorkflowPermissions(file: string, content: string): Finding[] {
  const findings: Finding[] = [];
  if (/permissions:\s*write-all\b/i.test(content)) {
    findings.push({
      ruleId: "permissions-write-all",
      severity: "high",
      title: "permissions: write-all",
      detail: "Prefer least-privilege job permissions instead of write-all.",
      file,
      line: lineOf(content, /permissions:\s*write-all/i),
    });
  }
  if (/permissions:\s*read-all\b/i.test(content)) {
    findings.push({
      ruleId: "permissions-read-all",
      severity: "medium",
      title: "permissions: read-all",
      detail: "read-all is broad; scope permissions to the jobs that need them.",
      file,
      line: lineOf(content, /permissions:\s*read-all/i),
    });
  }
  // top-level missing permissions block (heuristic: has jobs: but no permissions:)
  if (/^\s*jobs:\s*$/m.test(content) && !/^\s*permissions:\s*/m.test(content)) {
    findings.push({
      ruleId: "missing-permissions",
      severity: "medium",
      title: "No permissions: block",
      detail: "Without an explicit permissions block, GITHUB_TOKEN may be broader than needed.",
      file,
      line: lineOf(content, /^\s*jobs:\s*$/m) ?? 1,
    });
  }
  if (/contents:\s*write/i.test(content) && /pull-requests:\s*write/i.test(content) && /id-token:\s*write/i.test(content)) {
    findings.push({
      ruleId: "broad-combo",
      severity: "medium",
      title: "Broad permission combo",
      detail: "contents+pull-requests+id-token write together is a wide trust surface — confirm each is required.",
      file,
      line: lineOf(content, /contents:\s*write/i),
    });
  }
  return findings;
}
