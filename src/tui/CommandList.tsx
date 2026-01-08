import { bold, fg, t } from "@opentui/core";
import type { Command } from "../storage/types";

export interface CommandListProps {
  commands: Command[];
  selectedIndex: number;
  searchQuery: string;
  searchFocused: boolean;
  showFavoritesOnly: boolean;
  statusMessage: string | null;
  onSearchChange?: (value: string) => void;
}

export const CommandList = ({
  commands,
  selectedIndex,
  searchQuery,
  searchFocused,
  showFavoritesOnly,
  statusMessage,
  onSearchChange,
}: CommandListProps) => {
  // Calculate visible area (simple scrolling)
  const maxVisible = 15;
  const startIndex = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
  const visibleCommands = commands.slice(startIndex, startIndex + maxVisible);
  const adjustedSelectedIndex = selectedIndex - startIndex;

  return (
    <box
      style={{
        flexDirection: "column",
        padding: 1,
        width: "100%",
        height: "100%",
      }}
    >
      {/* Header */}
      <text
        content={t`${bold(fg("#00FFFF")("Comma"))} - Command Manager`}
        style={{ marginBottom: 1 }}
      />

      {/* Search box */}
      <box
        title="Search"
        style={{
          border: true,
          borderColor: searchFocused ? "#00FFFF" : "#666666",
          width: "100%",
          height: 3,
          marginBottom: 1,
        }}
      >
        <input
          value={searchQuery}
          placeholder={showFavoritesOnly ? "/ to search favorites..." : "/ to search..."}
          focused={searchFocused}
          onInput={onSearchChange}
          onChange={onSearchChange}
        />
      </box>

      {/* Filter indicator */}
      {showFavoritesOnly && (
        <text
          content="Showing favorites only (Tab to show all)"
          style={{ fg: "#FFFF00", marginBottom: 1 }}
        />
      )}

      {/* Command list */}
      <box
        style={{
          flexDirection: "column",
          flexGrow: 1,
          width: "100%",
        }}
      >
        {commands.length === 0 ? (
          <text
            content={
              searchQuery
                ? "No commands match your search."
                : showFavoritesOnly
                  ? "No favorites yet. Press 'f' to favorite a command."
                  : "No commands yet. Press 'n' to add one."
            }
            style={{ fg: "#888888" }}
          />
        ) : (
          visibleCommands.map((cmd, index) => {
            const isSelected = index === adjustedSelectedIndex;
            const favIcon = cmd.favorite ? "* " : "  ";
            const usageStr = cmd.usageCount > 0 ? ` (${cmd.usageCount})` : "";

            // Truncate command if too long
            let displayCmd = cmd.command;
            if (displayCmd.length > 50) {
              displayCmd = displayCmd.slice(0, 47) + "...";
            }

            return (
              <text
                key={cmd.id}
                content={`${isSelected ? ">" : " "} ${favIcon}${cmd.id}: ${displayCmd}${usageStr}`}
                style={{
                  fg: isSelected ? "#FFFFFF" : cmd.favorite ? "#FFFF00" : "#CCCCCC",
                  bg: isSelected ? "#333366" : undefined,
                }}
              />
            );
          })
        )}
      </box>

      {/* Status message or help */}
      <box style={{ marginTop: 1, flexDirection: "column" }}>
        {statusMessage ? (
          <text content={statusMessage} style={{ fg: "#00FF00" }} />
        ) : (
          <>
            <text
              content={`${commands.length} command${commands.length !== 1 ? "s" : ""}`}
              style={{ fg: "#888888" }}
            />
            <text
              content="[n]ew [e]dit [d]elete [f]av [/]search [Tab]filter [Enter]run [q]uit"
              style={{ fg: "#666666", marginTop: 1 }}
            />
          </>
        )}
      </box>
    </box>
  );
};
