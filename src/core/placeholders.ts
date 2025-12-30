import type { Placeholder } from "../storage/types";

/**
 * Regex to match placeholders: {name} or {name:default}
 * Captures:
 * - Group 1: placeholder name
 * - Group 2: default value (optional)
 */
const PLACEHOLDER_REGEX = /(?<!\\)\{([a-zA-Z_][a-zA-Z0-9_-]*)(?::([^}]*))?\}/g;

/**
 * Regex to match escaped braces
 */
const ESCAPED_BRACE_REGEX = /\\([{}])/g;

/**
 * Parse placeholders from a command string
 */
export function parsePlaceholders(command: string): Placeholder[] {
  const placeholders: Placeholder[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = PLACEHOLDER_REGEX.exec(command)) !== null) {
    const name = match[1] as string;
    const defaultValue = match[2] as string | undefined;
    const fullMatch = match[0];

    // Skip duplicates
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);

    placeholders.push({
      name,
      defaultValue,
      required: defaultValue === undefined,
      match: fullMatch,
    });
  }

  return placeholders;
}

/**
 * Check if a command has any placeholders
 */
export function hasPlaceholders(command: string): boolean {
  PLACEHOLDER_REGEX.lastIndex = 0;
  return PLACEHOLDER_REGEX.test(command);
}

/**
 * Substitute placeholders in a command with provided values
 */
export function substitutePlaceholders(
  command: string,
  values: Record<string, string>
): string {
  let result = command.replace(PLACEHOLDER_REGEX, (match, name, defaultValue) => {
    if (name in values && values[name] !== undefined && values[name] !== "") {
      return values[name];
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    // Return original if no value and no default (should be caught by validation)
    return match;
  });

  // Unescape escaped braces
  result = result.replace(ESCAPED_BRACE_REGEX, "$1");

  return result;
}

/**
 * Validate that all required placeholders have values
 */
export function validatePlaceholderValues(
  placeholders: Placeholder[],
  values: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const ph of placeholders) {
    if (ph.required) {
      const value = values[ph.name];
      if (value === undefined || value === "") {
        missing.push(ph.name);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Build initial values object from placeholders (with defaults)
 */
export function buildInitialValues(
  placeholders: Placeholder[]
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const ph of placeholders) {
    values[ph.name] = ph.defaultValue ?? "";
  }

  return values;
}

/**
 * Map positional arguments to placeholders
 */
export function mapArgsToPlaceholders(
  placeholders: Placeholder[],
  args: string[]
): Record<string, string> {
  const values = buildInitialValues(placeholders);

  // Map args in order
  for (let i = 0; i < Math.min(args.length, placeholders.length); i++) {
    const placeholder = placeholders[i];
    const arg = args[i];
    if (placeholder && arg !== undefined) {
      values[placeholder.name] = arg;
    }
  }

  return values;
}
