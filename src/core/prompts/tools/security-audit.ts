import { ToolArgs } from "./types"

export function getSecurityAuditDescription(args: ToolArgs): string {
	return `## security_audit
Description: Perform a security audit of a specified file or directory to surface potential vulnerabilities or risky patterns.

Workflow guidance:
- After you finish making code changes (e.g., write_to_file / apply_diff / apply_patch), run this tool on the changed file(s) (or the smallest containing directory if multiple files were changed).
- Use absolute paths for <target> (e.g., ${args.cwd}/src/foo/bar.ts) to avoid ambiguity.
- If the audit returns findings (e.g., via a SARIF report path or relevant output), review them and apply targeted security fixes. Prefer minimal, high-impact changes.
- Do not scan the entire workspace unless the user explicitly asks. Prefer the narrowest target that covers the change.

Parameters:
- target: (required) Absolute file or directory path to audit. MUST be provided. Do not call this tool without a concrete target. Do not use relative paths.

Usage (single file):
<security_audit>
<target>${args.cwd}/src/foo/bar.ts</target>
</security_audit>

Usage (directory):
<security_audit>
<target>${args.cwd}/apps/api</target>
</security_audit>

CRITICAL: Never run this tool without setting <target>.`
}
