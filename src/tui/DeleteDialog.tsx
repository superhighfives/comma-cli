import { useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { bold, fg, t } from "@opentui/core";
import type { Command } from "../storage/types";

export interface DeleteDialogProps {
  command: Command;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteDialog = ({
  command,
  onConfirm,
  onCancel,
}: DeleteDialogProps) => {
  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "n") {
      onCancel();
      return;
    }

    if (key.name === "y" || key.name === "return") {
      onConfirm();
      return;
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        padding: 2,
        width: "100%",
        height: "100%",
      }}
    >
      <text
        content={t`${bold(fg("red")("Delete Command"))}`}
        style={{ marginBottom: 2 }}
      />

      <text content="Are you sure you want to delete this command?" style={{ marginBottom: 2 }} />

      <box
        style={{
          border: true,
          borderColor: "#666666",
          padding: 1,
          width: 60,
          flexDirection: "column",
        }}
      >
        <text content={`ID:      ${command.id}`} />
        <text content={`Command: ${command.command}`} />
        {command.description && (
          <text content={`Desc:    ${command.description}`} />
        )}
        <text content={`Uses:    ${command.usageCount}`} />
        <text content={`Favorite: ${command.favorite ? "Yes" : "No"}`} />
      </box>

      <text
        content="This action cannot be undone."
        style={{ fg: "red", marginTop: 2 }}
      />

      <text
        content="[y/Enter] Delete  [n/Esc] Cancel"
        style={{ fg: "#666666", marginTop: 2 }}
      />
    </box>
  );
};
