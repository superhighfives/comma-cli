/**
 * Represents a saved command in the store
 */
export interface Command {
  /** Unique identifier (alphanumeric + hyphens) */
  id: string;
  /** The command string with optional placeholders */
  command: string;
  /** Optional description */
  description?: string;
  /** Whether this command is favorited */
  favorite: boolean;
  /** Unix timestamp when created */
  createdAt: number;
  /** Unix timestamp when last updated */
  updatedAt: number;
  /** Number of times this command has been executed */
  usageCount: number;
  /** Unix timestamp when last executed */
  lastUsed?: number;
}

/**
 * The root structure of the commands JSON file
 */
export interface CommandStore {
  /** Schema version for migrations */
  version: string;
  /** Array of saved commands */
  commands: Command[];
}

/**
 * Represents a placeholder parsed from a command string
 */
export interface Placeholder {
  /** The placeholder name */
  name: string;
  /** Optional default value */
  defaultValue?: string;
  /** Whether a value is required (no default provided) */
  required: boolean;
  /** The full match string including braces */
  match: string;
}

/**
 * Result of parsing CLI arguments
 */
export interface ParsedArgs {
  /** The subcommand (add, edit, delete, etc.) or null for TUI/execution */
  subcommand: string | null;
  /** The command ID (for execution or subcommand target) */
  commandId?: string;
  /** Additional positional arguments */
  args: string[];
  /** Flag values */
  flags: {
    help: boolean;
    version: boolean;
    exec: boolean;
    raw: boolean;
    noTui: boolean;
    output?: "json" | "table";
  };
}

/**
 * Result of command execution preparation
 */
export interface ExecutionResult {
  success: boolean;
  /** The resolved command ready to execute */
  command?: string;
  /** Error message if success is false */
  error?: string;
}

/**
 * Shell types we support
 */
export type ShellType = "bash" | "zsh" | "fish" | "unknown";

/**
 * Result of shell detection
 */
export interface ShellInfo {
  type: ShellType;
  configPath: string;
  name: string;
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Current application version
 * Dynamically read from package.json to keep in sync with releases
 */
export const VERSION = (() => {
  try {
    // Read package.json synchronously at module load time
    const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
    const pkgPath = join(repoRoot, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    // Fallback if package.json can't be read
    return "0.0.0";
  }
})();

/**
 * Current store schema version
 */
export const STORE_VERSION = "1.0";

/**
 * Reserved subcommand names that cannot be used as command IDs
 */
export const RESERVED_KEYWORDS = [
  "add",
  "edit",
  "delete",
  "rm",
  "list",
  "ls",
  "search",
  "fav",
  "favorite",
  "favorites",
  "favs",
  "info",
  "export",
  "import",
  "setup",
  "init",
  "run",
  "help",
] as const;

export type ReservedKeyword = (typeof RESERVED_KEYWORDS)[number];
