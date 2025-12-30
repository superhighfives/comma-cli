import { RESERVED_KEYWORDS } from "../storage/types";

/**
 * Regex for valid command IDs:
 * - Alphanumeric characters and hyphens
 * - Must start with alphanumeric
 * - Must end with alphanumeric
 * - No consecutive hyphens
 * Examples: "dev", "my-command", "test-123", "4-new-idea"
 */
const ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a command ID
 */
export function validateId(id: string): ValidationResult {
  if (!id) {
    return { valid: false, error: "ID is required" };
  }

  if (id.length > 50) {
    return { valid: false, error: "ID must be 50 characters or less" };
  }

  // Check for reserved keywords
  if (RESERVED_KEYWORDS.includes(id as any)) {
    return {
      valid: false,
      error: `'${id}' is a reserved keyword and cannot be used as a command ID`,
    };
  }

  // Check format
  if (!ID_REGEX.test(id)) {
    return {
      valid: false,
      error:
        "ID must be lowercase alphanumeric with hyphens (e.g., 'my-command', 'test-123')",
    };
  }

  return { valid: true };
}

/**
 * Validate a command string
 */
export function validateCommand(command: string): ValidationResult {
  if (!command) {
    return { valid: false, error: "Command is required" };
  }

  if (command.length > 2000) {
    return { valid: false, error: "Command must be 2000 characters or less" };
  }

  return { valid: true };
}

/**
 * Normalize a potential ID (lowercase, trim)
 */
export function normalizeId(id: string): string {
  return id.toLowerCase().trim();
}

/**
 * Check if a string could be a valid ID format (for CLI parsing)
 */
export function looksLikeId(str: string): boolean {
  return ID_REGEX.test(str.toLowerCase());
}
