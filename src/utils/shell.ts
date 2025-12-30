import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, copyFile } from "fs/promises";
import type { ShellType, ShellInfo } from "../storage/types";
import { fileExists } from "../storage/config";

/**
 * Detect the current shell type
 */
export function detectShell(): ShellInfo {
  const shell = process.env.SHELL || "";
  const home = homedir();

  if (shell.includes("zsh")) {
    return {
      type: "zsh",
      configPath: join(home, ".zshrc"),
      name: "Zsh",
    };
  }

  if (shell.includes("bash")) {
    // Check for .bash_profile on macOS, .bashrc on Linux
    const bashProfile = join(home, ".bash_profile");
    const bashrc = join(home, ".bashrc");

    return {
      type: "bash",
      configPath: process.platform === "darwin" ? bashProfile : bashrc,
      name: "Bash",
    };
  }

  if (shell.includes("fish")) {
    return {
      type: "fish",
      configPath: join(home, ".config", "fish", "config.fish"),
      name: "Fish",
    };
  }

  return {
    type: "unknown",
    configPath: "",
    name: "Unknown",
  };
}

/**
 * Generate shell function for bash/zsh
 */
function generateBashZshFunction(): string {
  return `
# Comma - Command Manager
# Added by: comma setup
comma() {
  case "$1" in
    add|edit|delete|rm|list|ls|search|fav|favorite|favorites|favs|info|export|import|setup|init|--help|--version)
      command comma "$@"
      ;;
    "")
      command comma
      ;;
    *)
      local output
      local status
      
      output=$(command comma --exec "$@" 2>&1)
      status=$?
      
      if [ $status -eq 0 ]; then
        if echo "$output" | grep -q "^__COMMA_EXEC__$"; then
          local cmd
          cmd=$(echo "$output" | sed -n '/__COMMA_EXEC__/,/__COMMA_END__/p' | sed '1d;$d')
          eval "$cmd"
        else
          eval "$output"
        fi
      else
        echo "$output" >&2
        return $status
      fi
      ;;
  esac
}
`.trim();
}

/**
 * Generate shell function for fish
 */
function generateFishFunction(): string {
  return `
# Comma - Command Manager
# Added by: comma setup
function comma
    switch "$argv[1]"
        case add edit delete rm list ls search fav favorite favorites favs info export import setup init --help --version
            command comma $argv
        case ''
            command comma
        case '*'
            set -l output (command comma --exec $argv 2>&1)
            set -l status_code $status
            
            if test $status_code -eq 0
                if echo $output | grep -q "^__COMMA_EXEC__\$"
                    set -l cmd (echo $output | sed -n '/__COMMA_EXEC__/,/__COMMA_END__/p' | sed '1d;$d')
                    eval $cmd
                else
                    eval $output
                end
            else
                echo $output >&2
                return $status_code
            end
    end
end
`.trim();
}

/**
 * Generate shell initialization code
 */
export function generateShellInit(shellType: ShellType): string {
  switch (shellType) {
    case "bash":
    case "zsh":
      return generateBashZshFunction();
    case "fish":
      return generateFishFunction();
    default:
      return `# Shell type '${shellType}' is not supported`;
  }
}

/**
 * The line we add to shell config
 */
export function getInitLine(shellType: ShellType): string {
  if (shellType === "fish") {
    return 'comma init fish | source';
  }
  return 'eval "$(comma init)"';
}

/**
 * Check if shell integration is already installed
 */
export async function isShellIntegrationInstalled(
  configPath: string
): Promise<boolean> {
  if (!(await fileExists(configPath))) {
    return false;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    return content.includes("comma init") || content.includes("# Comma - Command Manager");
  } catch {
    return false;
  }
}

/**
 * Install shell integration
 */
export async function installShellIntegration(
  shellInfo: ShellInfo
): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  if (shellInfo.type === "unknown") {
    return {
      success: false,
      error: "Could not detect shell type. Please install manually.",
    };
  }

  try {
    // Check if already installed
    if (await isShellIntegrationInstalled(shellInfo.configPath)) {
      return {
        success: true,
        error: "Shell integration already installed.",
      };
    }

    // Backup existing config
    let backupPath: string | undefined;
    if (await fileExists(shellInfo.configPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      backupPath = `${shellInfo.configPath}.backup.${timestamp}`;
      await copyFile(shellInfo.configPath, backupPath);
    }

    // Read existing content
    let existingContent = "";
    if (await fileExists(shellInfo.configPath)) {
      existingContent = await readFile(shellInfo.configPath, "utf-8");
    }

    // Append init line
    const initLine = getInitLine(shellInfo.type);
    const newContent = existingContent.trim()
      ? `${existingContent}\n\n${initLine}\n`
      : `${initLine}\n`;

    await writeFile(shellInfo.configPath, newContent, "utf-8");

    return { success: true, backupPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if we're running with shell integration (function wrapper)
 */
export function hasShellIntegration(): boolean {
  // The shell function sets this env var before calling --exec
  // Actually, we can't easily detect this, so we'll check at runtime
  // based on whether --exec flag is present
  return false;
}

/**
 * Format command for execution output
 */
export function formatExecOutput(command: string): string {
  return `__COMMA_EXEC__\n${command}\n__COMMA_END__`;
}
