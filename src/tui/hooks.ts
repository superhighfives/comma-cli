import { useState, useEffect, useCallback, useMemo } from "react";
import type { Command } from "../storage/types";
import { getCommands } from "../storage/store";
import { searchCommands } from "../utils/fuzzy";

/**
 * Hook to load and manage commands
 */
export function useCommands() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cmds = await getCommands();
      setCommands(cmds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commands");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { commands, loading, error, refresh };
}

/**
 * Hook for fuzzy search with commands
 */
export function useFuzzySearch(commands: Command[], query: string) {
  return useMemo(() => {
    return searchCommands(commands, query);
  }, [commands, query]);
}

/**
 * Hook for keyboard navigation in a list
 */
export function useListNavigation<T>(
  items: T[],
  options?: {
    wrap?: boolean;
    initialIndex?: number;
  }
) {
  const [selectedIndex, setSelectedIndex] = useState(options?.initialIndex ?? 0);
  const wrap = options?.wrap ?? true;

  // Reset selection when items change
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev <= 0) {
        return wrap ? items.length - 1 : 0;
      }
      return prev - 1;
    });
  }, [items.length, wrap]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev >= items.length - 1) {
        return wrap ? 0 : items.length - 1;
      }
      return prev + 1;
    });
  }, [items.length, wrap]);

  const setIndex = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setSelectedIndex(index);
    }
  }, [items.length]);

  const selectedItem = items[selectedIndex];

  return {
    selectedIndex,
    selectedItem,
    moveUp,
    moveDown,
    setIndex,
  };
}

/**
 * Hook for managing focus between multiple inputs
 */
export function useFocusManager<T extends string>(
  fields: T[],
  initialField?: T
) {
  const firstField = fields[0] as T;
  const [focusedField, setFocusedField] = useState<T>(
    initialField ?? firstField
  );

  const focusNext = useCallback(() => {
    setFocusedField((current) => {
      const currentIndex = fields.indexOf(current);
      const nextIndex = (currentIndex + 1) % fields.length;
      return fields[nextIndex] as T;
    });
  }, [fields]);

  const focusPrev = useCallback(() => {
    setFocusedField((current) => {
      const currentIndex = fields.indexOf(current);
      const prevIndex = (currentIndex - 1 + fields.length) % fields.length;
      return fields[prevIndex] as T;
    });
  }, [fields]);

  const focus = useCallback((field: T) => {
    if (fields.includes(field)) {
      setFocusedField(field);
    }
  }, [fields]);

  return {
    focusedField,
    focusNext,
    focusPrev,
    focus,
    isFocused: (field: T) => focusedField === field,
  };
}
