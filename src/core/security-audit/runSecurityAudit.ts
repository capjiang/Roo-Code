import fs from "fs/promises"
import path from "path"

import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"
import { getWorkspacePath } from "../../utils/path"
import { Task } from "../task/Task"

export type SecurityAuditRunResult =
	| {
			status: "success"
			workspace: string
			sarifPath: string
			outputTail: string
	  }
	| {
			status: "failed"
			workspace?: string
			sarifPath?: string
			message: string
			outputTail?: string
	  }

const OUT_DIR_SEGMENTS = [".roo", "secanalyzer"] as const
const PROJECT_NAME = "roo_security_audit" as const
const SARIF_FILENAME = `${PROJECT_NAME}.sarif` as const

type CommandRunResult = {
	exitCode: number | undefined
	output: string
}

async function runAndCaptureOutput(
	terminal: Awaited<ReturnType<typeof TerminalRegistry.getOrCreateTerminal>>,
	command: string,
): Promise<CommandRunResult> {
	let output = ""
	let exitCode: number | undefined

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

	return { exitCode, output }
}

function toTail(text: string, maxChars: number): string {
	if (maxChars <= 0) return ""
	return text.length > maxChars ? text.slice(-maxChars) : text
}

export async function runSecurityAuditInWorkspace(task: Task): Promise<SecurityAuditRunResult> {
	const workspace = task.cwd && task.cwd.trim() !== "" ? task.cwd : getWorkspacePath()
	if (!workspace) {
		return {
			status: "failed",
			message: "Security audit cannot run because the workspace path is not available.",
		}
	}

	const outDir = path.join(workspace, ...OUT_DIR_SEGMENTS)
	const sarifPath = path.join(outDir, SARIF_FILENAME)

	let terminal: Awaited<ReturnType<typeof TerminalRegistry.getOrCreateTerminal>>
	try {
		await fs.mkdir(outDir, { recursive: true })
		terminal = await TerminalRegistry.getOrCreateTerminal(workspace, task.taskId, "execa")
	} catch (error) {
		return {
			status: "failed",
			workspace,
			sarifPath,
			message: `Security audit setup failed.\n\nError: ${(error as Error)?.message ?? String(error)}`,
		}
	}

	const LOCAL_PREFLIGHT_CMD = "secanalyzer.sh -h" as const

	// Prefer local runner if available; otherwise fall back to Docker runner.
	let runner: "local" | "docker" | undefined

	let localPreflight: CommandRunResult | undefined
	try {
		localPreflight = await runAndCaptureOutput(terminal, LOCAL_PREFLIGHT_CMD)
		if (localPreflight.exitCode === 0) {
			runner = "local"
		}
	} catch (error) {
		localPreflight = {
			exitCode: undefined,
			output: `Local preflight threw: ${(error as Error)?.message ?? String(error)}`,
		}
	}

	let dockerChecksOutput = ""
	if (!runner) {
		const DOCKER_VERSION_CMD = "docker --version" as const
		const DOCKER_IMAGE_CHECK_CMD = 'docker image inspect secanalyzer:local --format "{{.Id}}"' as const

		try {
			const dockerVersion = await runAndCaptureOutput(terminal, DOCKER_VERSION_CMD)
			dockerChecksOutput += `> ${DOCKER_VERSION_CMD}\n${dockerVersion.output}\n`

			if (dockerVersion.exitCode === 0) {
				const dockerImageCheck = await runAndCaptureOutput(terminal, DOCKER_IMAGE_CHECK_CMD)
				dockerChecksOutput += `> ${DOCKER_IMAGE_CHECK_CMD}\n${dockerImageCheck.output}\n`

				if (dockerImageCheck.exitCode === 0) {
					runner = "docker"
				}
			}
		} catch (error) {
			dockerChecksOutput += `Docker preflight threw: ${(error as Error)?.message ?? String(error)}\n`
		}
	}

	// environment is not set up for either local or Docker runner
	if (!runner) {
		const localExit = localPreflight?.exitCode
		const localOutputTail = toTail(localPreflight?.output ?? "", 2000)

		const combinedTail = toTail(
			[
				`[Local preflight] ${LOCAL_PREFLIGHT_CMD} (exit code: ${localExit ?? "unknown"})`,
				localOutputTail ? localOutputTail : "",
				dockerChecksOutput ? `[Docker preflight]\n${dockerChecksOutput}` : "",
			]
				.filter(Boolean)
				.join("\n\n"),
			4000,
		)

		return {
			status: "failed",
			workspace,
			sarifPath,
			message:
				"Security audit cannot run because neither local `secanalyzer.sh` nor the Docker runner is available.\n\n" +
				"To use the local runner, install/configure `secanalyzer.sh` on your PATH.\n" +
				"To use the Docker runner, install Docker and ensure the image `secanalyzer:local` exists (see jsa/README_DOCKER.md).",
			outputTail: combinedTail || undefined,
		}
	}

	const command =
		runner === "local"
			? `secanalyzer.sh "${workspace}" --outFormat=sarif --outPath="${outDir}" --project=${PROJECT_NAME}`
			: (() => {
					const userFlag = `--user "$(id -u)":"$(id -g)" `
					const inputMount = `-v "${workspace}":/input:ro`
					const outputMount = `-v "${outDir}":/output`

					return (
						`docker run --rm ` +
						userFlag +
						`${inputMount} ${outputMount} ` +
						`secanalyzer:local ` +
						`/input --project=${PROJECT_NAME} --outFormat=sarif --outPath=/output`
					)
				})()

	let output = `[security-audit] runner=${runner}\n> ${command}\n\n`
	let exitCode: number | undefined

	try {
		const result = await runAndCaptureOutput(terminal, command)
		exitCode = result.exitCode
		output += result.output
	} catch (error) {
		return {
			status: "failed",
			workspace,
			sarifPath,
			message: `Security audit failed to execute.\n\nError: ${(error as Error)?.message ?? String(error)}`,
			outputTail: toTail(output, 4000),
		}
	}

	if (exitCode !== undefined && exitCode !== 0) {
		return {
			status: "failed",
			workspace,
			sarifPath,
			message: `Security audit exited with code ${exitCode}.`,
			outputTail: toTail(output, 4000),
		}
	}

	try {
		await fs.access(sarifPath)
	} catch {
		return {
			status: "failed",
			workspace,
			sarifPath,
			message: "Security audit finished but SARIF file was not found.",
			outputTail: toTail(output, 4000),
		}
	}

	return {
		status: "success",
		workspace,
		sarifPath,
		outputTail: toTail(output, 4000),
	}
}
