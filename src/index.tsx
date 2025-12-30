#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { parseArgs } from "./cli/parser";
import {
  formatHelp,
  formatVersion,
  formatError,
  formatSuccess,
  formatCommandTable,
  formatCommandJson,
  formatCommandInfo,
  formatNoShellIntegration,
} from "./cli/formatters";
import {
  getCommands,
  getCommand,
  addCommand,
  updateCommand,
  deleteCommand,
  toggleFavorite,
  recordUsage,
  exportCommands,
  importCommands,
} from "./storage/store";
import { VERSION, type CommandStore } from "./storage/types";
import { validateId, validateCommand } from "./core/validation";
import {
  parsePlaceholders,
  mapArgsToPlaceholders,
  substitutePlaceholders,
  validatePlaceholderValues,
} from "./core/placeholders";
import { searchCommands } from "./utils/fuzzy";
import {
  detectShell,
  generateShellInit,
  installShellIntegration,
  isShellIntegrationInstalled,
  formatExecOutput,
} from "./utils/shell";
import { readFile, writeFile } from "fs/promises";
import { App } from "./tui/App";

/**
 * Main CLI entry point
 */
async function main() {
  const args = parseArgs(process.argv);

  // Handle flags
  if (args.flags.help) {
    console.log(formatHelp());
    process.exit(0);
  }

  if (args.flags.version) {
    console.log(formatVersion(VERSION));
    process.exit(0);
  }

  // Handle --exec flag (for shell integration)
  if (args.flags.exec || args.flags.raw) {
    await handleExec(args.commandId, args.args, args.flags.raw);
    return;
  }

  // Handle subcommands
  if (args.subcommand) {
    await handleSubcommand(args.subcommand, args.commandId, args.args, args.flags);
    return;
  }

  // If command ID provided, try to execute it
  if (args.commandId) {
    await handleRun(args.commandId, args.args);
    return;
  }

  // No args - launch TUI
  await launchTui();
}

/**
 * Handle --exec/--raw flag for shell integration or direct eval
 * @param raw If true, output just the command without markers (for direct eval)
 */
async function handleExec(commandId: string | undefined, args: string[], raw = false) {
  if (!commandId) {
    console.error(formatError("Command ID required"));
    process.exit(1);
  }

  const command = await getCommand(commandId);
  if (!command) {
    console.error(formatError(`Command '${commandId}' not found`));
    process.exit(1);
  }

  // Parse and resolve placeholders
  const placeholders = parsePlaceholders(command.command);
  let resolved = command.command;

  if (placeholders.length > 0) {
    const values = mapArgsToPlaceholders(placeholders, args);
    const validation = validatePlaceholderValues(placeholders, values);

    if (!validation.valid) {
      // Missing required placeholders - need interactive input
      // For now, error out (TUI handles interactive prompts)
      console.error(
        formatError(`Missing required placeholder${validation.missing.length > 1 ? "s" : ""}: ${validation.missing.join(", ")}`)
      );
      process.exit(1);
    }

    resolved = substitutePlaceholders(command.command, values);
  }

  // Output the command - raw mode for direct eval, markers for shell function
  if (raw) {
    console.log(resolved);
  } else {
    console.log(formatExecOutput(resolved));
  }

  // Record usage
  await recordUsage(commandId);
  process.exit(0);
}

/**
 * Handle running a command by ID
 */
async function handleRun(commandId: string, args: string[]) {
  const command = await getCommand(commandId);
  if (!command) {
    console.error(formatError(`Command '${commandId}' not found`));
    console.error("\nAvailable commands:");
    const commands = await getCommands();
    commands.slice(0, 5).forEach((c) => console.error(`  ${c.id}`));
    if (commands.length > 5) {
      console.error(`  ... and ${commands.length - 5} more`);
    }
    process.exit(1);
  }

  // Check shell integration
  const shellInfo = detectShell();
  const hasIntegration = await isShellIntegrationInstalled(shellInfo.configPath);

  if (!hasIntegration) {
    // Show warning and the command to run
    const placeholders = parsePlaceholders(command.command);
    let resolved = command.command;

    if (placeholders.length > 0) {
      const values = mapArgsToPlaceholders(placeholders, args);
      const validation = validatePlaceholderValues(placeholders, values);

      if (!validation.valid) {
        console.error(
          formatError(`Missing required placeholder${validation.missing.length > 1 ? "s" : ""}: ${validation.missing.join(", ")}`)
        );
        process.exit(1);
      }

      resolved = substitutePlaceholders(command.command, values);
    }

    console.log(formatNoShellIntegration(commandId, resolved));
    process.exit(0);
  }

  // With shell integration, this code path shouldn't be reached
  // (the shell function intercepts and uses --exec)
  // But just in case, output the command
  console.log(formatExecOutput(command.command));
}

/**
 * Handle subcommands
 */
async function handleSubcommand(
  subcommand: string,
  commandId: string | undefined,
  args: string[],
  flags: { output?: "json" | "table" }
) {
  switch (subcommand) {
    case "add": {
      if (!commandId || args.length === 0) {
        console.error(formatError("Usage: comma add <id> <command>"));
        process.exit(1);
      }

      const idValidation = validateId(commandId);
      if (!idValidation.valid) {
        console.error(formatError(idValidation.error!));
        process.exit(1);
      }

      const cmd = args.join(" ");
      const cmdValidation = validateCommand(cmd);
      if (!cmdValidation.valid) {
        console.error(formatError(cmdValidation.error!));
        process.exit(1);
      }

      try {
        await addCommand(commandId, cmd);
        console.log(formatSuccess(`Added command '${commandId}'`));
      } catch (err) {
        console.error(formatError(err instanceof Error ? err.message : "Failed to add"));
        process.exit(1);
      }
      break;
    }

    case "edit": {
      if (!commandId) {
        console.error(formatError("Usage: comma edit <id> [command]"));
        process.exit(1);
      }

      const existing = await getCommand(commandId);
      if (!existing) {
        console.error(formatError(`Command '${commandId}' not found`));
        process.exit(1);
      }

      if (args.length === 0) {
        // Launch TUI in edit mode
        await launchTui(commandId, "edit");
        return;
      }

      const newCmd = args.join(" ");
      const cmdValidation = validateCommand(newCmd);
      if (!cmdValidation.valid) {
        console.error(formatError(cmdValidation.error!));
        process.exit(1);
      }

      try {
        await updateCommand(commandId, { command: newCmd });
        console.log(formatSuccess(`Updated command '${commandId}'`));
      } catch (err) {
        console.error(formatError(err instanceof Error ? err.message : "Failed to update"));
        process.exit(1);
      }
      break;
    }

    case "delete":
    case "rm": {
      if (!commandId) {
        console.error(formatError("Usage: comma delete <id>"));
        process.exit(1);
      }

      try {
        await deleteCommand(commandId);
        console.log(formatSuccess(`Deleted command '${commandId}'`));
      } catch (err) {
        console.error(formatError(err instanceof Error ? err.message : "Failed to delete"));
        process.exit(1);
      }
      break;
    }

    case "list":
    case "ls": {
      const commands = await getCommands();
      if (flags.output === "json") {
        console.log(formatCommandJson(commands));
      } else {
        console.log(formatCommandTable(commands));
      }
      break;
    }

    case "search": {
      if (!commandId) {
        console.error(formatError("Usage: comma search <query>"));
        process.exit(1);
      }

      const query = [commandId, ...args].join(" ");
      const allCommands = await getCommands();
      const results = searchCommands(allCommands, query);

      if (flags.output === "json") {
        console.log(formatCommandJson(results));
      } else {
        console.log(formatCommandTable(results));
      }
      break;
    }

    case "fav":
    case "favorite": {
      if (!commandId) {
        console.error(formatError("Usage: comma fav <id>"));
        process.exit(1);
      }

      try {
        const updated = await toggleFavorite(commandId);
        console.log(
          formatSuccess(
            updated.favorite
              ? `Favorited '${commandId}'`
              : `Unfavorited '${commandId}'`
          )
        );
      } catch (err) {
        console.error(formatError(err instanceof Error ? err.message : "Failed to toggle"));
        process.exit(1);
      }
      break;
    }

    case "favorites":
    case "favs": {
      const commands = await getCommands({ favoritesOnly: true });
      if (flags.output === "json") {
        console.log(formatCommandJson(commands));
      } else {
        console.log(formatCommandTable(commands));
      }
      break;
    }

    case "info": {
      if (!commandId) {
        console.error(formatError("Usage: comma info <id>"));
        process.exit(1);
      }

      const command = await getCommand(commandId);
      if (!command) {
        console.error(formatError(`Command '${commandId}' not found`));
        process.exit(1);
      }

      console.log(formatCommandInfo(command));
      break;
    }

    case "setup": {
      await handleSetup();
      break;
    }

    case "init": {
      const shellType = commandId as "bash" | "zsh" | "fish" | undefined;
      const shell = shellType ?? detectShell().type;
      console.log(generateShellInit(shell));
      break;
    }

    case "export": {
      const store = await exportCommands();
      if (commandId) {
        // Export to file
        await writeFile(commandId, JSON.stringify(store, null, 2));
        console.log(formatSuccess(`Exported ${store.commands.length} commands to ${commandId}`));
      } else {
        // Export to stdout
        console.log(JSON.stringify(store, null, 2));
      }
      break;
    }

    case "import": {
      if (!commandId) {
        console.error(formatError("Usage: comma import <file>"));
        process.exit(1);
      }

      try {
        const content = await readFile(commandId, "utf-8");
        const store = JSON.parse(content) as CommandStore;
        const result = await importCommands(store);
        console.log(
          formatSuccess(
            `Imported ${result.imported} commands${result.skipped > 0 ? `, skipped ${result.skipped} existing` : ""}`
          )
        );
      } catch (err) {
        console.error(formatError(err instanceof Error ? err.message : "Failed to import"));
        process.exit(1);
      }
      break;
    }

    case "run": {
      // Explicit run command
      if (!commandId) {
        console.error(formatError("Usage: comma run <id>"));
        process.exit(1);
      }
      await handleRun(commandId, args);
      break;
    }

    default:
      console.error(formatError(`Unknown command: ${subcommand}`));
      console.log("\nRun 'comma --help' for usage information.");
      process.exit(1);
  }
}

/**
 * Handle setup command - install shell integration
 */
async function handleSetup() {
  const shellInfo = detectShell();

  console.log("Comma - Shell Integration Setup\n");
  console.log(`Detected shell: ${shellInfo.name}`);
  console.log(`Config file: ${shellInfo.configPath}\n`);

  if (shellInfo.type === "unknown") {
    console.error(formatError("Could not detect shell type"));
    console.log("\nManual setup instructions:");
    console.log('  Add to your shell config: eval "$(comma init)"');
    process.exit(1);
  }

  const alreadyInstalled = await isShellIntegrationInstalled(shellInfo.configPath);
  if (alreadyInstalled) {
    console.log("Shell integration is already installed.");
    console.log("\nIf it's not working, try restarting your shell:");
    console.log("  exec $SHELL");
    process.exit(0);
  }

  console.log("This will add the following line to your shell config:");
  console.log(`  eval "$(comma init)"\n`);

  // In a full implementation, we'd prompt for confirmation
  // For now, just install
  const result = await installShellIntegration(shellInfo);

  if (!result.success) {
    console.error(formatError(result.error ?? "Failed to install"));
    process.exit(1);
  }

  console.log("Shell integration installed successfully!");
  if (result.backupPath) {
    console.log(`\nBackup created: ${result.backupPath}`);
  }
  console.log("\nRestart your shell to activate:");
  console.log("  exec $SHELL");
  console.log("\nOr reload your config:");
  console.log(`  source ${shellInfo.configPath}`);
}

/**
 * Launch the TUI
 */
async function launchTui(editId?: string, mode?: "edit") {
  const renderer = await createCliRenderer();

  createRoot(renderer).render(
    <App
      onExit={(data) => {
        // Stop and destroy the renderer
        renderer.stop();
        renderer.destroy();
        
        // Show spinner while terminal restores
        const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        let frameIndex = 0;
        const spinnerText = "Running command...";
        const spinner = setInterval(() => {
          process.stdout.write(`\r${spinnerFrames[frameIndex]} ${spinnerText}`);
          frameIndex = (frameIndex + 1) % spinnerFrames.length;
        }, 50);
        
        // Delay to ensure terminal is fully restored before printing
        setTimeout(() => {
          clearInterval(spinner);
          process.stdout.write(`\r${" ".repeat(spinnerText.length + 3)}\r`); // Clear spinner
          if (data.message) {
            process.stdout.write(data.message + "\n");
          }
          process.exit(data.code);
        }, 300);
      }}
    />
  );
}

// Run main
main().catch((err) => {
  console.error(formatError(err instanceof Error ? err.message : "Unknown error"));
  process.exit(1);
});
