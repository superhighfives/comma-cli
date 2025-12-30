import type { Command, CommandStore } from "../storage/types";

/**
 * Format a list of commands as a table
 */
export function formatCommandTable(commands: Command[]): string {
  if (commands.length === 0) {
    return "No commands found.\n\nUse 'comma add <id> <command>' to create one.";
  }

  // Calculate column widths
  const idWidth = Math.max(4, ...commands.map((c) => c.id.length));
  const cmdWidth = Math.min(
    50,
    Math.max(7, ...commands.map((c) => c.command.length))
  );

  // Build header
  const header = [
    "ID".padEnd(idWidth),
    "Command".padEnd(cmdWidth),
    "Fav",
    "Uses",
  ].join("  ");

  const separator = "-".repeat(header.length);

  // Build rows
  const rows = commands.map((cmd) => {
    const id = cmd.id.padEnd(idWidth);
    let command = cmd.command;
    if (command.length > cmdWidth) {
      command = command.slice(0, cmdWidth - 3) + "...";
    }
    command = command.padEnd(cmdWidth);
    const fav = cmd.favorite ? " * " : "   ";
    const uses = cmd.usageCount.toString().padStart(4);

    return `${id}  ${command}  ${fav}  ${uses}`;
  });

  // Footer
  const favCount = commands.filter((c) => c.favorite).length;
  const footer = `\n${commands.length} command${commands.length !== 1 ? "s" : ""}${favCount > 0 ? `, ${favCount} favorite${favCount !== 1 ? "s" : ""}` : ""}`;

  return [header, separator, ...rows, footer].join("\n");
}

/**
 * Format a list of commands as JSON
 */
export function formatCommandJson(commands: Command[]): string {
  return JSON.stringify(commands, null, 2);
}

/**
 * Format a single command's info
 */
export function formatCommandInfo(command: Command): string {
  const lines = [
    `ID:          ${command.id}`,
    `Command:     ${command.command}`,
  ];

  if (command.description) {
    lines.push(`Description: ${command.description}`);
  }

  lines.push(`Favorite:    ${command.favorite ? "Yes" : "No"}`);
  lines.push(`Usage Count: ${command.usageCount}`);

  if (command.lastUsed) {
    lines.push(`Last Used:   ${new Date(command.lastUsed).toLocaleString()}`);
  }

  lines.push(`Created:     ${new Date(command.createdAt).toLocaleString()}`);
  lines.push(`Updated:     ${new Date(command.updatedAt).toLocaleString()}`);

  return lines.join("\n");
}

/**
 * Format help text
 */
export function formatHelp(): string {
  return `
Comma - Command Manager

Usage:
  comma                     Open interactive TUI
  comma <id>                Run a saved command
  comma <id> [args...]      Run with placeholder arguments

Commands:
  add <id> <command>        Add a new command
  edit <id> [command]       Edit a command (TUI if no command given)
  delete <id>               Delete a command
  rm <id>                   Alias for delete
  list                      List all commands
  ls                        Alias for list
  search <query>            Search commands
  fav <id>                  Toggle favorite status
  info <id>                 Show command details
  setup                     Setup shell integration
  init [shell]              Output shell function
  export [file]             Export commands to JSON
  import <file>             Import commands from JSON

Options:
  -h, --help                Show this help
  -v, --version             Show version
  -o, --output <format>     Output format: json, table (for list command)
  -r, --raw <id>            Output raw command for eval (no markers)

Placeholders:
  Use {name} in commands for required placeholders
  Use {name:default} for optional placeholders with defaults

Examples:
  comma add dev "cd ~/Development"
  comma add deploy "git push {remote:origin} {branch:main}"
  comma dev
  comma deploy origin feature-branch
  comma fav dev

Shell Integration:
  Run 'comma setup' to enable commands that affect your current shell
  (required for commands like 'cd', 'export', etc.)
`.trim();
}

/**
 * Format version string
 */
export function formatVersion(version: string): string {
  return `comma v${version}`;
}

/**
 * Format error message
 */
export function formatError(message: string): string {
  return `Error: ${message}`;
}

/**
 * Format success message
 */
export function formatSuccess(message: string): string {
  return message;
}

/**
 * Format shell integration not installed warning
 */
export function formatNoShellIntegration(commandId: string, resolvedCommand: string): string {
  return `
Shell integration not detected!

Setup required to run commands in your current shell.
Run: comma setup

─────────────────────────────────────
Command to execute:
  ${resolvedCommand}

For now, you can run manually:
  eval "$(comma --raw ${commandId})"
─────────────────────────────────────
`.trim();
}
