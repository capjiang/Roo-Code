import fs from "fs/promises"
import path from "path"

import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import type { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"
import { getWorkspacePath } from "../../utils/path"

type SecurityAuditParams = {
	target: string
}

/**
 * Placeholder security audit tool.
 * Currently does not integrate with external scanners; returns a stub message.
 */
export class SecurityAuditTool extends BaseTool<"security_audit"> {
	readonly name = "security_audit" as const

	parseLegacy(params: Partial<Record<string, string>>): SecurityAuditParams {
		return { target: params.target ?? "" }
	}

	async execute(params: SecurityAuditParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, pushToolResult, handleError } = callbacks

		const targetPath = params.target?.trim()
		if (!targetPath) {
			pushToolResult(
				"Security audit aborted: a specific target path is required. Provide a file or directory path.",
			)
			return
		}

		const workspace = task.cwd && task.cwd.trim() !== "" ? task.cwd : getWorkspacePath()
		if (!workspace) {
			await handleError("security_audit", new Error("Workspace path is not available."))
			return
		}

		// Resolve target path relative to workspace
		const auditTarget = path.resolve(workspace, targetPath)

		const sharedMessageProps: ClineSayTool = {
			tool: "securityAudit",
			target: auditTarget,
			isOutsideWorkspace: false,
		}

		const didApprove = await askApproval("tool", JSON.stringify(sharedMessageProps))
		if (!didApprove) {
			pushToolResult(formatResponse.toolDenied())
			return
		}

		const approvalMessageTs = task.lastMessageTs

		const outDir = path.join(workspace, ".roo", "secanalyzer")
		const projectName = "roo_security_audit"
		const sarifPath = path.join(outDir, `${projectName}.sarif`)

		await fs.mkdir(outDir, { recursive: true })

		const terminal = await TerminalRegistry.getOrCreateTerminal(workspace, task.taskId, "execa")

		// Preflight: verify we can run the scanner in this environment before attempting a full scan.
		try {
			let helpOutput = ""
			let helpExitCode: number | undefined = undefined

			await terminal.runCommand(`secanalyzer.sh -h`, {
				onLine: (line) => {
					helpOutput += line + "\n"
				},
				onCompleted: () => {},
				onShellExecutionStarted: () => {},
				onShellExecutionComplete: (details) => {
					helpExitCode = details.exitCode
				},
			})

			if (helpExitCode !== 0) {
				const message =
					`Security audit cannot run because \`secanalyzer.sh\` is not available or failed to run.\n\n` +
					`Please install/configure \`secanalyzer.sh\` on your machine and ensure it is on your PATH, then retry.\n\n` +
					`Preflight exit code: ${helpExitCode ?? "unknown"}\n` +
					`Preflight output (tail):\n${helpOutput.slice(-2000)}`

				// Best-effort: surface the reason in the tool row so the user sees it without relying on the LLM response.
				try {
					if (approvalMessageTs) {
						const index = task.clineMessages.findIndex((m) => m.ts === approvalMessageTs)
						if (index !== -1) {
							const updatedToolMessage: ClineSayTool = { ...sharedMessageProps, content: message }
							const updatedMessage = {
								...task.clineMessages[index],
								type: "say" as const,
								ask: "tool" as const,
								text: JSON.stringify(updatedToolMessage),
								partial: false,
							}

							task.clineMessages[index] = updatedMessage
							const provider = task.providerRef.deref()
							await provider?.postMessageToWebview({
								type: "messageUpdated",
								clineMessage: updatedMessage,
							})
							await task.overwriteClineMessages([...task.clineMessages])
						}
					}
				} catch {
					// Ignore UI update errors - still return the failure to the model via tool_result.
				}

				pushToolResult(message)
				return
			}
		} catch (error) {
			const message =
				`Security audit cannot run because \`secanalyzer.sh\` could not be executed.\n\n` +
				`Please install/configure \`secanalyzer.sh\` on your machine and ensure it is on your PATH, then retry.\n\n` +
				`Error: ${(error as Error)?.message ?? String(error)}`

			try {
				if (approvalMessageTs) {
					const index = task.clineMessages.findIndex((m) => m.ts === approvalMessageTs)
					if (index !== -1) {
						const updatedToolMessage: ClineSayTool = { ...sharedMessageProps, content: message }
						const updatedMessage = {
							...task.clineMessages[index],
							type: "say" as const,
							ask: "tool" as const,
							text: JSON.stringify(updatedToolMessage),
							partial: false,
						}

						task.clineMessages[index] = updatedMessage
						const provider = task.providerRef.deref()
						await provider?.postMessageToWebview({ type: "messageUpdated", clineMessage: updatedMessage })
						await task.overwriteClineMessages([...task.clineMessages])
					}
				}
			} catch {
				// Ignore UI update errors - still return the failure to the model via tool_result.
			}

			pushToolResult(message)
			return
		}

		const command = `secanalyzer.sh "${auditTarget}" --outFormat=sarif --outPath="${outDir}" --project=${projectName}`
		let output = ""
		let exitCode: number | undefined = undefined

		try {
			await terminal.runCommand(command, {
				onLine: (line) => {
					output += line + "\n"
				},
				onCompleted: () => {},
				onShellExecutionStarted: () => {},
				onShellExecutionComplete: (details) => {
					exitCode = details.exitCode
				},
			})
		} catch (error) {
			await handleError("security_audit", error as Error)
			return
		}

		// Update the original tool approval message with the command output summary (UI-only)
		try {
			if (approvalMessageTs) {
				const index = task.clineMessages.findIndex((m) => m.ts === approvalMessageTs)
				if (index !== -1) {
					const updatedToolMessage: ClineSayTool = { ...sharedMessageProps, content: output.slice(-4000) }
					const updatedMessage = {
						...task.clineMessages[index],
						type: "say" as const,
						ask: "tool" as const,
						text: JSON.stringify(updatedToolMessage),
						partial: false,
					}

					task.clineMessages[index] = updatedMessage
					const provider = task.providerRef.deref()
					await provider?.postMessageToWebview({ type: "messageUpdated", clineMessage: updatedMessage })
					await task.overwriteClineMessages([...task.clineMessages])
				}
			}
		} catch {
			// Ignore UI update errors - audit result still returned to the model via tool_result.
		}

		if (exitCode !== undefined && exitCode !== 0) {
			pushToolResult(`secanalyzer exited with code ${exitCode}. Output:\n\n${output.slice(-4000)}`)
			return
		}

		let sarifExists = false
		try {
			await fs.access(sarifPath)
			sarifExists = true
		} catch {
			sarifExists = false
		}

		if (!sarifExists) {
			pushToolResult(
				`Security audit finished but SARIF file not found at ${sarifPath}. Output:\n\n${output.slice(-4000)}`,
			)
			return
		}

		const relativeSarif = path.relative(workspace, sarifPath)
		pushToolResult(
			`Security audit completed. SARIF report: ${relativeSarif}\n` +
				`请使用 read_file 工具读取该 SARIF 文件的内容，概括关键问题并提出具体安全优化建议。\n` +
				`命令输出摘要:\n${output.slice(-4000)}`,
		)
	}

	override async handlePartial(task: Task, block: ToolUse<"security_audit">): Promise<void> {
		const sharedMessageProps = {
			tool: "securityAudit",
			target: block.params.target,
			isOutsideWorkspace: false,
		}

		await task.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

export const securityAuditTool = new SecurityAuditTool()
