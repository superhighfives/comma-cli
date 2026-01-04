import { homedir } from "os";
import { join } from "path";
import { mkdir, copyFile, access, constants } from "fs/promises";

/**
 * Get the config directory path (~/.config/comma-cli/)
 */
export function getConfigDir(): string {
  return join(homedir(), ".config", "comma-cli");
}

/**
 * Get the commands file path (~/.config/comma-cli/commands.json)
 */
export function getCommandsFilePath(): string {
  return join(getConfigDir(), "commands.json");
}

/**
 * Ensure the config directory exists
 */
export async function ensureConfigDir(): Promise<void> {
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a backup of a file with timestamp
 */
export async function createBackup(filePath: string): Promise<string | null> {
  if (!(await fileExists(filePath))) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const backupPath = `${filePath}.backup.${timestamp}`;

  await copyFile(filePath, backupPath);
  return backupPath;
}

/**
 * Get temp file path for atomic writes
 */
export function getTempFilePath(filePath: string): string {
  return `${filePath}.tmp.${process.pid}`;
}
