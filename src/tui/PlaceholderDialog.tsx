import { useState, useCallback, useMemo } from "react";
import { useKeyboard } from "@opentui/react";
import { bold, fg, t } from "@opentui/core";
import type { Command, Placeholder } from "../storage/types";
import {
  parsePlaceholders,
  buildInitialValues,
  mapArgsToPlaceholders,
  validatePlaceholderValues,
} from "../core/placeholders";

export interface PlaceholderDialogProps {
  command: Command;
  initialArgs?: string[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export const PlaceholderDialog = ({
  command,
  initialArgs = [],
  onSubmit,
  onCancel,
}: PlaceholderDialogProps) => {
  const placeholders = useMemo(() => parsePlaceholders(command.command), [command.command]);
  
  const [values, setValues] = useState<Record<string, string>>(() => 
    mapArgsToPlaceholders(placeholders, initialArgs)
  );
  
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleValueChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    const validation = validatePlaceholderValues(placeholders, values);
    if (!validation.valid) {
      setError(`Missing required: ${validation.missing.join(", ")}`);
      return;
    }
    onSubmit(values);
  }, [placeholders, values, onSubmit]);

  const focusNext = useCallback(() => {
    setFocusedIndex((prev) => 
      prev < placeholders.length - 1 ? prev + 1 : prev
    );
  }, [placeholders.length]);

  const focusPrev = useCallback(() => {
    setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel();
      return;
    }

    if (key.name === "tab") {
      if (key.shift) {
        focusPrev();
      } else {
        focusNext();
      }
      return;
    }

    if (key.ctrl && key.name === "return") {
      handleSubmit();
      return;
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        padding: 1,
        width: "100%",
        height: "100%",
      }}
    >
      <text
        content={t`${bold(fg("#00FFFF")(`Run: ${command.id}`))}`}
        style={{ marginBottom: 1 }}
      />

      <text
        content={`Command: ${command.command}`}
        style={{ fg: "#888888", marginBottom: 2 }}
      />

      {/* Placeholder inputs */}
      {placeholders.map((ph, index) => (
        <box
          key={ph.name}
          title={`${ph.name}${ph.required ? " (required)" : " (optional)"}`}
          style={{
            border: true,
            borderColor: focusedIndex === index ? "#00FFFF" : "#666666",
            width: 60,
            height: 3,
            marginBottom: 1,
          }}
        >
          <input
            placeholder={ph.defaultValue ?? `Enter ${ph.name}...`}
            value={values[ph.name] ?? ""}
            onInput={(value) => handleValueChange(ph.name, value)}
            onSubmit={index === placeholders.length - 1 ? handleSubmit : focusNext}
            focused={focusedIndex === index}
            style={{ focusedBackgroundColor: "#1a1a1a" }}
          />
        </box>
      ))}

      {/* Error message */}
      {error && (
        <text
          content={`Error: ${error}`}
          style={{ fg: "red", marginTop: 1 }}
        />
      )}

      {/* Help */}
      <text
        content="[Tab] Next field  [Shift+Tab] Previous  [Ctrl+Enter] Execute  [Esc] Cancel"
        style={{ fg: "#666666", marginTop: 1 }}
      />
    </box>
  );
};
