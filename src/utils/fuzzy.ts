import Fuse, { type IFuseOptions } from "fuse.js";
import type { Command } from "../storage/types";

/**
 * Fuse.js options for command searching
 * - ID has higher weight than command text
 * - Threshold controls fuzziness (lower = stricter)
 */
const FUSE_OPTIONS: IFuseOptions<Command> = {
  keys: [
    { name: "id", weight: 2 },
    { name: "command", weight: 1 },
    { name: "description", weight: 0.5 },
  ],
  threshold: 0.4,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 1,
};

/**
 * Create a fuzzy search index for commands
 */
export function createSearchIndex(commands: Command[]): Fuse<Command> {
  return new Fuse(commands, FUSE_OPTIONS);
}

/**
 * Search commands with fuzzy matching
 * - Favorites are boosted to the top
 * - Empty query returns all commands (sorted)
 */
export function searchCommands(
  commands: Command[],
  query: string
): Command[] {
  // Empty query returns all commands sorted
  if (!query.trim()) {
    return sortCommands(commands);
  }

  const fuse = createSearchIndex(commands);
  const results = fuse.search(query);

  // Extract commands from results
  const matched = results.map((r) => r.item);

  // Sort with favorites first
  return sortCommands(matched);
}

/**
 * Sort commands: favorites first, then by usage count, then alphabetically
 */
export function sortCommands(commands: Command[]): Command[] {
  return [...commands].sort((a, b) => {
    // Favorites first
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    // Then by usage count (descending)
    if (a.usageCount !== b.usageCount) {
      return b.usageCount - a.usageCount;
    }
    // Then alphabetically by ID
    return a.id.localeCompare(b.id);
  });
}
