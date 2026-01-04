# Comma CLI

A command-line command manager for saving, organizing, and executing frequently used shell commands.

## Features

- **Save commands** with memorable IDs (e.g., `comma-cli dev` instead of typing `cd ~/Development && npm run dev`)
- **Placeholders** with optional defaults: `git push {remote:origin} {branch:main}`
- **Interactive TUI** for browsing, searching, and managing commands
- **Fuzzy search** across command IDs, text, and descriptions
- **Favorites** to prioritize your most-used commands
- **Usage tracking** with execution counts and timestamps
- **Shell integration** for commands that affect your current session (`cd`, `export`, etc.)
- **Import/Export** for backup and sharing command collections

## Installation

### Via npm (Recommended)

```bash
npm install -g comma-cli
```

The package will automatically download and install the correct binary for your platform.

### Supported Platforms

Comma CLI provides pre-built binaries for:

- **macOS**: Apple Silicon (arm64) and Intel (x64)
- **Linux**: x64 and arm64
- **Windows**: x64

### Platform-Specific Packages

If you need to install a specific platform package directly:

- [`comma-cli-darwin-arm64`](https://www.npmjs.com/package/comma-cli-darwin-arm64) - macOS Apple Silicon
- [`comma-cli-darwin-x64`](https://www.npmjs.com/package/comma-cli-darwin-x64) - macOS Intel
- [`comma-cli-linux-x64`](https://www.npmjs.com/package/comma-cli-linux-x64) - Linux x64
- [`comma-cli-linux-arm64`](https://www.npmjs.com/package/comma-cli-linux-arm64) - Linux ARM64
- [`comma-cli-windows-x64`](https://www.npmjs.com/package/comma-cli-windows-x64) - Windows x64

```bash
npm install -g comma-cli-darwin-arm64  # Example for macOS Apple Silicon
```

### From Source

```bash
# Clone the repository
git clone https://github.com/superhighfives/comma-cli.git
cd comma-cli

# Install dependencies (requires Bun)
bun install

# Build for your platform
bun run build

# Or build for all platforms
bun run build:all
```

### Shell Integration

For full functionality (especially commands like `cd` that need to run in your current shell), run:

```bash
comma-cli setup
```

This adds a shell function to your config file (`.bashrc`, `.zshrc`, or `config.fish`) that enables direct command execution.

## Usage

### Interactive Mode

```bash
comma-cli
```

Opens the TUI where you can browse, search, and execute commands.

**Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `j` / `k` or `Up` / `Down` | Navigate list |
| `Enter` | Execute selected command |
| `n` | Add new command |
| `e` | Edit selected command |
| `d` | Delete selected command |
| `f` | Toggle favorite |
| `/` or `Ctrl+F` | Search |
| `Tab` | Toggle favorites-only filter |
| `q` or `Esc` | Quit |
| `Ctrl+R` | Refresh |

### CLI Commands

```bash
# Run a saved command
comma-cli <id>

# Run with placeholder arguments
comma-cli deploy staging   # Fills first placeholder with "staging"

# Add a new command
comma-cli add <id> "<command>"
comma-cli add dev "cd ~/projects && npm run dev"
comma-cli add deploy "kubectl apply -f {file}"

# Edit a command
comma-cli edit <id>                  # Opens TUI editor
comma-cli edit <id> "<new-command>"  # Direct update

# Delete a command
comma-cli delete <id>
comma-cli rm <id>          # Alias

# List all commands
comma-cli list
comma-cli ls               # Alias
comma-cli list -o json     # JSON output

# Search commands
comma-cli search <query>

# Toggle favorite
comma-cli fav <id>

# Show command details
comma-cli info <id>

# Export/Import
comma-cli export                     # Exports to stdout
comma-cli export commands.json       # Exports to file
comma-cli import commands.json       # Import from file

# Get raw command (for scripting)
comma-cli -r <id>
```

### Placeholders

Commands can include placeholders that are filled at execution time:

```bash
# Required placeholder
comma-cli add greet "echo Hello, {name}!"
comma-cli greet World                    # → echo Hello, World!

# Optional placeholder with default
comma-cli add push "git push {remote:origin} {branch:main}"
comma-cli push                           # → git push origin main
comma-cli push upstream                  # → git push upstream main
comma-cli push upstream feature          # → git push upstream feature

# Escape braces when needed
comma-cli add literal "echo \{not a placeholder\}"
```

## Configuration

Commands are stored in `~/.config/comma-cli/commands.json`.

### Command Structure

```json
{
  "version": "1.0",
  "commands": [
    {
      "id": "dev",
      "command": "cd ~/projects && npm run dev",
      "description": "Start development server",
      "favorite": true,
      "createdAt": 1703980800000,
      "updatedAt": 1703980800000,
      "usageCount": 42,
      "lastUsed": 1704067200000
    }
  ]
}
```

## Tech Stack

- **[Bun](https://bun.sh)** - JavaScript runtime
- **[TypeScript](https://www.typescriptlang.org)** - Type safety
- **[React 19](https://react.dev)** - UI components
- **[OpenTUI](https://github.com/example/opentui)** - Terminal UI rendering
- **[Fuse.js](https://fusejs.io)** - Fuzzy search

## Project Structure

```
src/
  index.tsx           # CLI entry point
  cli/
    parser.ts         # Argument parsing
    formatters.ts     # Output formatting (table/JSON)
  core/
    placeholders.ts   # Placeholder parsing and substitution
    validation.ts     # ID and command validation
  storage/
    config.ts         # Config paths (~/.config/comma-cli/)
    store.ts          # CRUD operations
    types.ts          # TypeScript interfaces
  tui/
    App.tsx           # Main TUI application
    CommandList.tsx   # Command list component
    CommandDialog.tsx # Add/Edit dialog
    DeleteDialog.tsx  # Delete confirmation
    PlaceholderDialog.tsx  # Placeholder input
    hooks.ts          # React hooks
  utils/
    fuzzy.ts          # Fuzzy search wrapper
    shell.ts          # Shell detection
scripts/
  build.ts            # Cross-platform build script
  release.ts          # npm publishing script
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode (with hot reload)
bun dev

# Run directly
bun run src/index.tsx

# Type checking
bun run typecheck
```

## Building

Comma CLI uses Bun's compile feature to create standalone executables for multiple platforms.

```bash
# Build for current platform
bun run build

# Build for all platforms
bun run build:all

# Build for specific target(s)
bun run scripts/build.ts --target darwin-arm64
bun run scripts/build.ts --target linux-x64,linux-arm64
```

**Supported targets:**

| Target | OS | Architecture |
|--------|-----|--------------|
| `darwin-arm64` | macOS | Apple Silicon |
| `darwin-x64` | macOS | Intel |
| `linux-x64` | Linux | x86_64 |
| `linux-arm64` | Linux | ARM64 |
| `win32-x64` | Windows | x86_64 |

Build output is written to `./dist/comma-cli-{os}-{arch}/`.

## Releasing

The release script builds all platforms and publishes to npm.

```bash
# Dry run (test without publishing)
bun run release:dry

# Release to npm
NPM_TOKEN=your-token bun run release

# Release with a specific tag
NPM_TOKEN=your-token bun run release -- --tag beta

# Skip build (if already built)
NPM_TOKEN=your-token bun run release -- --skip-build
```

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `NPM_TOKEN` | npm authentication token (required for publishing) |
| `NPM_TAG` | Distribution tag (default: `latest`) |
| `OUTPUT_DIR` | Build output directory (default: `./dist`) |
| `TARGETS` | Comma-separated targets or `all` |

## Validation Rules

- **Command ID**: Lowercase alphanumeric and hyphens only, max 50 characters
- **Command**: Max 2000 characters
- **Reserved IDs**: `add`, `edit`, `delete`, `rm`, `list`, `ls`, `search`, `fav`, `info`, `setup`, `init`, `export`, `import`, `help`

## Why Shell Integration?

Some commands (like `cd`, `export`, `alias`) must run in your current shell to have any effect. Without shell integration, comma-cli runs commands in a subprocess, which means:

- `cd` changes directory in the subprocess, not your terminal
- `export` sets variables that disappear when the subprocess exits

The `comma-cli setup` command installs a shell function that intercepts command execution and runs commands directly in your shell using `eval`.

## License

MIT
