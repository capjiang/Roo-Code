import type OpenAI from "openai"

const securityAudit: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "security_audit",
		description:
			"Run a security audit on a specific file or directory (typically the file(s) you just changed). After completing code modifications, call this tool on the changed path(s). If the audit reports issues, use the report/output to apply focused security fixes.",
		parameters: {
			type: "object",
			required: ["target"],
			properties: {
				target: {
					type: "string",
					description:
						"Required. Absolute file or directory path to audit. Prefer the file(s) you just modified.",
				},
			},
			additionalProperties: false,
		},
	},
}

export default securityAudit
