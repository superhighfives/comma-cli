import { useCallback, useState } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import type { Command } from "../storage/types";
import {
  addCommand,
  updateCommand,
  deleteCommand,
  toggleFavorite,
  recordUsage,
} from "../storage/store";
import {
  parsePlaceholders,
  mapArgsToPlaceholders,
  substitutePlaceholders,
  validatePlaceholderValues,
  buildInitialValues,
} from "../core/placeholders";
import { validateId, validateCommand } from "../core/validation";
import { formatExecOutput, detectShell, isShellIntegrationInstalled } from "../utils/shell";
import { useCommands, useFuzzySearch, useListNavigation } from "./hooks";
import { CommandList } from "./CommandList";
import { CommandDialog } from "./CommandDialog";
import { DeleteDialog } from "./DeleteDialog";
import { PlaceholderDialog } from "./PlaceholderDialog";

export type View =
  | "list"
  | "add"
  | "edit"
  | "delete"
  | "placeholder"
  | "info";

export interface ExitData {
  /** Message to print after TUI closes */
  message?: string;
  /** Exit code */
  code: number;
}

export interface AppProps {
  /** If provided, execute this command ID immediately */
  executeId?: string;
  /** Arguments to pass to placeholders */
  executeArgs?: string[];
  /** If true, output command for shell execution */
  execMode?: boolean;
  /** Callback when app should exit */
  onExit?: (data: ExitData) => void;
}

export const App = ({ executeId, executeArgs, execMode, onExit }: AppProps) => {
  const renderer = useRenderer();
  const { commands, loading, error, refresh } = useCommands();
  const [view, setView] = useState<View>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [deletingCommand, setDeletingCommand] = useState<Command | null>(null);
  const [executingCommand, setExecutingCommand] = useState<Command | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filter and search commands
  const filteredCommands = showFavoritesOnly
    ? commands.filter((c) => c.favorite)
    : commands;
  const searchResults = useFuzzySearch(filteredCommands, searchQuery);

  // List navigation
  const {
    selectedIndex,
    selectedItem: selectedCommand,
    moveUp,
    moveDown,
    setIndex,
  } = useListNavigation(searchResults);

  // Show temporary status message
  const showStatus = useCallback((message: string, duration = 2000) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), duration);
  }, []);

  // Handle exit
  const handleExit = useCallback((code = 0, message?: string) => {
    if (onExit) {
      onExit({ code, message });
    } else {
      renderer?.stop();
      if (message) {
        console.log(message);
      }
      process.exit(code);
    }
  }, [onExit, renderer]);

  // Handle command execution
  const handleExecute = useCallback(async (command: Command, values?: Record<string, string>) => {
    const placeholders = parsePlaceholders(command.command);

    // If command has placeholders and no values provided, show dialog
    if (placeholders.length > 0 && !values) {
      setExecutingCommand(command);
      setView("placeholder");
      return;
    }

    // Resolve command
    const finalValues = values ?? {};
    const resolvedCommand = substitutePlaceholders(command.command, finalValues);

    // Record usage
    await recordUsage(command.id);

    // In exec mode, output command for shell integration
    if (execMode) {
      handleExit(0, formatExecOutput(resolvedCommand));
      return;
    }

    // Check if shell integration is installed
    const shellInfo = detectShell();
    const hasIntegration = await isShellIntegrationInstalled(shellInfo.configPath);

    // Build exit message based on shell integration status
    let message: string;
    
    if (hasIntegration) {
      // Shell integration installed - just show what will run
      message = [
        "",
        "─────────────────────────────────────",
        `Command: ${command.id}`,
        `Execute: ${resolvedCommand}`,
        "─────────────────────────────────────",
        "",
        "Run this command directly:",
        `  comma ${command.id}`,
      ].join("\n");
    } else {
      // No shell integration - show setup instructions
      message = [
        "",
        "Shell integration not detected!",
        "",
        "─────────────────────────────────────",
        `Command: ${command.id}`,
        `Execute: ${resolvedCommand}`,
        "─────────────────────────────────────",
        "",
        "To run this command in your shell:",
        `  eval "$(comma --raw ${command.id})"`,
        "",
        "Or run 'comma setup' to enable automatic execution.",
      ].join("\n");
    }
    
    handleExit(0, message);
  }, [execMode, handleExit]);

  // Handle add command
  const handleAdd = useCallback(async (id: string, cmd: string, description?: string) => {
    const idValidation = validateId(id);
    if (!idValidation.valid) {
      showStatus(`Error: ${idValidation.error}`);
      return false;
    }

    const cmdValidation = validateCommand(cmd);
    if (!cmdValidation.valid) {
      showStatus(`Error: ${cmdValidation.error}`);
      return false;
    }

    try {
      await addCommand(id, cmd, description);
      await refresh();
      setView("list");
      showStatus(`Added command '${id}'`);
      return true;
    } catch (err) {
      showStatus(`Error: ${err instanceof Error ? err.message : "Failed to add"}`);
      return false;
    }
  }, [refresh, showStatus]);

  // Handle edit command
  const handleEdit = useCallback(async (id: string, cmd: string, description?: string) => {
    const cmdValidation = validateCommand(cmd);
    if (!cmdValidation.valid) {
      showStatus(`Error: ${cmdValidation.error}`);
      return false;
    }

    try {
      await updateCommand(id, { command: cmd, description });
      await refresh();
      setView("list");
      setEditingCommand(null);
      showStatus(`Updated command '${id}'`);
      return true;
    } catch (err) {
      showStatus(`Error: ${err instanceof Error ? err.message : "Failed to update"}`);
      return false;
    }
  }, [refresh, showStatus]);

  // Handle delete command
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteCommand(id);
      await refresh();
      setView("list");
      setDeletingCommand(null);
      showStatus(`Deleted command '${id}'`);
    } catch (err) {
      showStatus(`Error: ${err instanceof Error ? err.message : "Failed to delete"}`);
    }
  }, [refresh, showStatus]);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      const updated = await toggleFavorite(id);
      await refresh();
      showStatus(updated.favorite ? `Favorited '${id}'` : `Unfavorited '${id}'`);
    } catch (err) {
      showStatus(`Error: ${err instanceof Error ? err.message : "Failed to toggle favorite"}`);
    }
  }, [refresh, showStatus]);

  // Handle placeholder submission
  const handlePlaceholderSubmit = useCallback(async (values: Record<string, string>) => {
    if (!executingCommand) return;

    const placeholders = parsePlaceholders(executingCommand.command);
    const validation = validatePlaceholderValues(placeholders, values);

    if (!validation.valid) {
      showStatus(`Missing required: ${validation.missing.join(", ")}`);
      return;
    }

    await handleExecute(executingCommand, values);
    setExecutingCommand(null);
    setView("list");
  }, [executingCommand, handleExecute, showStatus]);

  // Global keyboard handler
  useKeyboard((key) => {
    // Ctrl+C to exit
    if (key.ctrl && key.name === "c") {
      handleExit(0);
      return;
    }

    // View-specific handlers
    if (view !== "list") {
      // ESC to go back to list
      if (key.name === "escape") {
        setView("list");
        setEditingCommand(null);
        setDeletingCommand(null);
        setExecutingCommand(null);
      }
      return;
    }

    // List view handlers when search is focused
    if (searchFocused) {
      // Handle escape to exit search mode
      if (key.name === "escape") {
        setSearchFocused(false);
        setSearchQuery("");
        return;
      }
      // Allow Enter to select current item while searching
      if (key.name === "return" && selectedCommand) {
        setSearchFocused(false);
        void handleExecute(selectedCommand);
        return;
      }
      // Allow arrow keys to navigate while typing
      if (key.name === "up" || (key.ctrl && key.name === "p")) {
        moveUp();
        return;
      }
      if (key.name === "down" || (key.ctrl && key.name === "n")) {
        moveDown();
        return;
      }
      // Handle backspace
      if (key.name === "backspace") {
        setSearchQuery((prev) => prev.slice(0, -1));
        return;
      }
      // Handle printable characters
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setSearchQuery((prev) => prev + key.sequence);
        return;
      }
      return;
    }

    // Navigation
    if (key.name === "up" || key.name === "k") {
      moveUp();
      return;
    }
    if (key.name === "down" || key.name === "j") {
      moveDown();
      return;
    }

    // Actions
    if (key.name === "return" && selectedCommand) {
      // Use void to handle the async function without blocking
      void handleExecute(selectedCommand);
      return;
    }

    if (key.name === "n") {
      setView("add");
      return;
    }

    if (key.name === "e" && selectedCommand) {
      setEditingCommand(selectedCommand);
      setView("edit");
      return;
    }

    if (key.name === "d" && selectedCommand) {
      setDeletingCommand(selectedCommand);
      setView("delete");
      return;
    }

    if (key.name === "f" && selectedCommand) {
      handleToggleFavorite(selectedCommand.id);
      return;
    }

    if (key.name === "/" || (key.ctrl && key.name === "f")) {
      setSearchFocused(true);
      return;
    }

    if (key.name === "tab") {
      setShowFavoritesOnly((prev) => !prev);
      return;
    }

    if (key.name === "q" || key.name === "escape") {
      handleExit(0);
      return;
    }

    if (key.ctrl && key.name === "r") {
      refresh();
      showStatus("Refreshed");
      return;
    }
  });

  // Render based on view
  if (loading) {
    return (
      <box style={{ padding: 1 }}>
        <text content="Loading..." />
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ padding: 1, flexDirection: "column" }}>
        <text content={`Error: ${error}`} style={{ fg: "red" }} />
        <text content="Press any key to exit..." style={{ marginTop: 1 }} />
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      {view === "list" && (
        <CommandList
          commands={searchResults}
          selectedIndex={selectedIndex}
          searchQuery={searchQuery}
          searchFocused={searchFocused}
          showFavoritesOnly={showFavoritesOnly}
          statusMessage={statusMessage}
          onSearchChange={setSearchQuery}
        />
      )}

      {view === "add" && (
        <CommandDialog
          mode="add"
          onSubmit={handleAdd}
          onCancel={() => setView("list")}
        />
      )}

      {view === "edit" && editingCommand && (
        <CommandDialog
          mode="edit"
          command={editingCommand}
          onSubmit={(id: string, cmd: string, desc?: string) => handleEdit(id, cmd, desc)}
          onCancel={() => {
            setView("list");
            setEditingCommand(null);
          }}
        />
      )}

      {view === "delete" && deletingCommand && (
        <DeleteDialog
          command={deletingCommand}
          onConfirm={() => handleDelete(deletingCommand.id)}
          onCancel={() => {
            setView("list");
            setDeletingCommand(null);
          }}
        />
      )}

      {view === "placeholder" && executingCommand && (
        <PlaceholderDialog
          command={executingCommand}
          initialArgs={executeArgs}
          onSubmit={handlePlaceholderSubmit}
          onCancel={() => {
            setView("list");
            setExecutingCommand(null);
          }}
        />
      )}
    </box>
  );
};
