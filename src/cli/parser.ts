import type { ParsedArgs } from "../storage/types";
import { RESERVED_KEYWORDS } from "../storage/types";

/**
 * Subcommands that the CLI recognizes
 */
const SUBCOMMANDS = new Set([
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
]);

/**
 * Parse command line arguments
 */
export function parseArgs(argv: string[]): ParsedArgs {
  // Skip first two args (bun and script path)
  const args = argv.slice(2);

  const result: ParsedArgs = {
    subcommand: null,
    args: [],
    flags: {
      help: false,
      version: false,
      exec: false,
      raw: false,
      noTui: false,
    },
  };

  const positionalArgs: string[] = [];
  let i = 0;

  // Parse all args, separating flags from positional
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.flags.help = true;
      i++;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      result.flags.version = true;
      i++;
      continue;
    }

    if (arg === "--exec") {
      result.flags.exec = true;
      i++;
      continue;
    }

    if (arg === "--raw" || arg === "-r") {
      result.flags.raw = true;
      i++;
      continue;
    }

    if (arg === "--no-tui") {
      result.flags.noTui = true;
      i++;
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      const nextArg = args[i + 1];
      if (nextArg === "json" || nextArg === "table") {
        result.flags.output = nextArg;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (arg?.startsWith("--output=")) {
      const value = arg.split("=")[1];
      if (value === "json" || value === "table") {
        result.flags.output = value;
      }
      i++;
      continue;
    }

    if (arg?.startsWith("-o=")) {
      const value = arg.split("=")[1];
      if (value === "json" || value === "table") {
        result.flags.output = value;
      }
      i++;
      continue;
    }

    // Not a flag, add to positional args
    if (arg) {
      positionalArgs.push(arg);
    }
    i++;
  }

  if (positionalArgs.length === 0) {
    return result;
  }

  const firstArg = positionalArgs[0];

  // Check if first arg is a subcommand
  if (firstArg && SUBCOMMANDS.has(firstArg)) {
    result.subcommand = firstArg;
    result.commandId = positionalArgs[1];
    result.args = positionalArgs.slice(2);
  } else {
    // First arg is a command ID to execute
    result.commandId = firstArg;
    result.args = positionalArgs.slice(1);
  }

  return result;
}

/**
 * Check if a string is a reserved keyword
 */
export function isReservedKeyword(str: string): boolean {
  return RESERVED_KEYWORDS.includes(str as any);
}
