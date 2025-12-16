import type { ClineSayTool } from "../../shared/ExtensionMessage"

export function isWriteToolAction(tool: ClineSayTool): boolean {
	return ["editedExistingFile", "appliedDiff", "newFileCreated", "generateImage"].includes(tool.tool)
}

export function isReadOnlyToolAction(tool: ClineSayTool): boolean {
	return [
		"readFile",
		"listFiles",
		"listFilesTopLevel",
		"listFilesRecursive",
		"listCodeDefinitionNames",
		"searchFiles",
		"codebaseSearch",
		"securityAudit",
		"runSlashCommand",
	].includes(tool.tool)
}
