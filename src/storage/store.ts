import { readFile, writeFile, rename, unlink } from "fs/promises";
import type { Command, CommandStore } from "./types";
import { STORE_VERSION } from "./types";
import {
  getCommandsFilePath,
  ensureConfigDir,
  fileExists,
  createBackup,
  getTempFilePath,
} from "./config";

/**
 * Create an empty command store
 */
function createEmptyStore(): CommandStore {
  return {
    version: STORE_VERSION,
    commands: [],
  };
}

/**
 * Load the command store from disk
 */
export async function loadStore(): Promise<CommandStore> {
  await ensureConfigDir();
  const filePath = getCommandsFilePath();

  if (!(await fileExists(filePath))) {
    return createEmptyStore();
  }

  try {
    const content = await readFile(filePath, "utf-8");
    const store = JSON.parse(content) as CommandStore;

    // Basic validation
    if (!store.version || !Array.isArray(store.commands)) {
      // Corrupted file - backup and reset
      await createBackup(filePath);
      return createEmptyStore();
    }

    return store;
  } catch (error) {
    // Parse error - backup and reset
    await createBackup(filePath);
    return createEmptyStore();
  }
}

/**
 * Save the command store to disk (atomic write)
 */
export async function saveStore(store: CommandStore): Promise<void> {
  await ensureConfigDir();
  const filePath = getCommandsFilePath();
  const tempPath = getTempFilePath(filePath);

  try {
    // Write to temp file
    await writeFile(tempPath, JSON.stringify(store, null, 2), "utf-8");

    // Atomic rename
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Get all commands, optionally filtered
 */
export async function getCommands(options?: {
  favoritesOnly?: boolean;
}): Promise<Command[]> {
  const store = await loadStore();
  let commands = store.commands;

  if (options?.favoritesOnly) {
    commands = commands.filter((c) => c.favorite);
  }

  // Sort: favorites first, then by usage count, then by name
  return commands.sort((a, b) => {
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    if (a.usageCount !== b.usageCount) {
      return b.usageCount - a.usageCount;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Get a single command by ID
 */
export async function getCommand(id: string): Promise<Command | null> {
  const store = await loadStore();
  return store.commands.find((c) => c.id === id) ?? null;
}

/**
 * Add a new command
 */
export async function addCommand(
  id: string,
  command: string,
  description?: string
): Promise<Command> {
  const store = await loadStore();

  // Check for duplicate
  if (store.commands.some((c) => c.id === id)) {
    throw new Error(`Command '${id}' already exists`);
  }

  const now = Date.now();
  const newCommand: Command = {
    id,
    command,
    description,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };

  store.commands.push(newCommand);
  await saveStore(store);

  return newCommand;
}

/**
 * Update an existing command
 */
export async function updateCommand(
  id: string,
  updates: Partial<Pick<Command, "command" | "description" | "favorite">>
): Promise<Command> {
  const store = await loadStore();
  const index = store.commands.findIndex((c) => c.id === id);

  const existing = store.commands[index];
  if (index === -1 || !existing) {
    throw new Error(`Command '${id}' not found`);
  }

  const updatedCommand: Command = {
    id: existing.id,
    command: updates.command ?? existing.command,
    description: updates.description ?? existing.description,
    favorite: updates.favorite ?? existing.favorite,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    usageCount: existing.usageCount,
    lastUsed: existing.lastUsed,
  };

  store.commands[index] = updatedCommand;
  await saveStore(store);

  return updatedCommand;
}

/**
 * Delete a command
 */
export async function deleteCommand(id: string): Promise<void> {
  const store = await loadStore();
  const index = store.commands.findIndex((c) => c.id === id);

  if (index === -1) {
    throw new Error(`Command '${id}' not found`);
  }

  store.commands.splice(index, 1);
  await saveStore(store);
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(id: string): Promise<Command> {
  const command = await getCommand(id);
  if (!command) {
    throw new Error(`Command '${id}' not found`);
  }

  return updateCommand(id, { favorite: !command.favorite });
}

/**
 * Record command usage
 */
export async function recordUsage(id: string): Promise<void> {
  const store = await loadStore();
  const index = store.commands.findIndex((c) => c.id === id);

  const command = store.commands[index];
  if (index === -1 || !command) {
    return; // Silently ignore if command doesn't exist
  }

  command.usageCount++;
  command.lastUsed = Date.now();
  await saveStore(store);
}

/**
 * Check if a command ID exists
 */
export async function commandExists(id: string): Promise<boolean> {
  const command = await getCommand(id);
  return command !== null;
}

/**
 * Export all commands
 */
export async function exportCommands(): Promise<CommandStore> {
  return loadStore();
}

/**
 * Import commands from a store (merges with existing)
 */
export async function importCommands(
  importStore: CommandStore,
  options?: { overwrite?: boolean }
): Promise<{ imported: number; skipped: number }> {
  const store = await loadStore();
  let imported = 0;
  let skipped = 0;

  for (const cmd of importStore.commands) {
    const existingIndex = store.commands.findIndex((c) => c.id === cmd.id);

    if (existingIndex === -1) {
      // New command - add it
      store.commands.push(cmd);
      imported++;
    } else if (options?.overwrite) {
      // Existing command - overwrite
      store.commands[existingIndex] = cmd;
      imported++;
    } else {
      // Existing command - skip
      skipped++;
    }
  }

  await saveStore(store);
  return { imported, skipped };
}
