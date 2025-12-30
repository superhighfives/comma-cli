import { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { bold, fg, t } from "@opentui/core";
import type { Command } from "../storage/types";
import { validateId, validateCommand } from "../core/validation";
import { useFocusManager } from "./hooks";

type DialogField = "id" | "command" | "description";

export interface CommandDialogProps {
  mode: "add" | "edit";
  command?: Command;
  onSubmit: (id: string, command: string, description?: string) => Promise<boolean>;
  onCancel: () => void;
}

export const CommandDialog = ({
  mode,
  command,
  onSubmit,
  onCancel,
}: CommandDialogProps) => {
  const [id, setId] = useState(command?.id ?? "");
  const [cmd, setCmd] = useState(command?.command ?? "");
  const [description, setDescription] = useState(command?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fields: DialogField[] = mode === "add" 
    ? ["id", "command", "description"]
    : ["command", "description"];
  
  const { focusedField, focusNext, isFocused } = useFocusManager(fields, fields[0]);

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Validate
    if (mode === "add") {
      const idValidation = validateId(id);
      if (!idValidation.valid) {
        setError(idValidation.error ?? "Invalid ID");
        return;
      }
    }

    const cmdValidation = validateCommand(cmd);
    if (!cmdValidation.valid) {
      setError(cmdValidation.error ?? "Invalid command");
      return;
    }

    setSubmitting(true);
    const success = await onSubmit(
      mode === "add" ? id : command!.id,
      cmd,
      description || undefined
    );
    setSubmitting(false);

    if (!success) {
      setError("Failed to save command");
    }
  }, [mode, id, cmd, description, command, onSubmit]);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel();
      return;
    }

    if (key.name === "tab") {
      focusNext();
      return;
    }

    // Ctrl+Enter or Enter on last field to submit
    if (key.ctrl && key.name === "return") {
      handleSubmit();
      return;
    }
  });

  const title = mode === "add" ? "Add Command" : `Edit: ${command?.id}`;

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
        content={t`${bold(fg("#00FFFF")(title))}`}
        style={{ marginBottom: 1 }}
      />

      {/* ID field (only for add mode) */}
      {mode === "add" && (
        <box
          title="ID"
          style={{
            border: true,
            borderColor: isFocused("id") ? "#00FFFF" : "#666666",
            width: 60,
            height: 3,
            marginBottom: 1,
          }}
        >
          <input
            placeholder="my-command (alphanumeric + hyphens)"
            value={id}
            onInput={setId}
            onSubmit={focusNext}
            focused={isFocused("id")}
            style={{ focusedBackgroundColor: "#1a1a1a" }}
          />
        </box>
      )}

      {/* Command field */}
      <box
        title="Command"
        style={{
          border: true,
          borderColor: isFocused("command") ? "#00FFFF" : "#666666",
          width: 60,
          height: 3,
          marginBottom: 1,
        }}
      >
        <input
          placeholder="cd ~/Development or echo {name}"
          value={cmd}
          onInput={setCmd}
          onSubmit={focusNext}
          focused={isFocused("command")}
          style={{ focusedBackgroundColor: "#1a1a1a" }}
        />
      </box>

      {/* Description field */}
      <box
        title="Description (optional)"
        style={{
          border: true,
          borderColor: isFocused("description") ? "#00FFFF" : "#666666",
          width: 60,
          height: 3,
          marginBottom: 1,
        }}
      >
        <input
          placeholder="What does this command do?"
          value={description}
          onInput={setDescription}
          onSubmit={handleSubmit}
          focused={isFocused("description")}
          style={{ focusedBackgroundColor: "#1a1a1a" }}
        />
      </box>

      {/* Tips */}
      <box style={{ marginTop: 1, flexDirection: "column" }}>
        <text content="Tips:" style={{ fg: "#888888" }} />
        <text content="  Use {name} for required placeholders" style={{ fg: "#666666" }} />
        <text content="  Use {name:default} for optional placeholders" style={{ fg: "#666666" }} />
      </box>

      {/* Error message */}
      {error && (
        <text
          content={`Error: ${error}`}
          style={{ fg: "red", marginTop: 1 }}
        />
      )}

      {/* Help */}
      <text
        content={submitting ? "Saving..." : "[Tab] Next field  [Ctrl+Enter] Save  [Esc] Cancel"}
        style={{ fg: "#666666", marginTop: 1 }}
      />
    </box>
  );
};
