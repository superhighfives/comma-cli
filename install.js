#!/usr/bin/env node

const { exec } = require("child_process");
const { platform, arch } = require("os");

// ANSI colors for better output
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const reset = "\x1b[0m";

// Map Node.js platform/arch to our package naming
const platformMap = {
  darwin: {
    arm64: "comma-cli-darwin-arm64",
    x64: "comma-cli-darwin-x64",
  },
  linux: {
    x64: "comma-cli-linux-x64",
    arm64: "comma-cli-linux-arm64",
  },
  win32: {
    x64: "comma-cli-windows-x64",
  },
};

function getPlatformPackage() {
  const currentPlatform = platform();
  const currentArch = arch();

  const platformPackages = platformMap[currentPlatform];
  if (!platformPackages) {
    return null;
  }

  return platformPackages[currentArch] || null;
}

function installPlatformPackage() {
  const packageName = getPlatformPackage();

  if (!packageName) {
    console.error(
      `${red}✗${reset} Unsupported platform: ${platform()}-${arch()}`
    );
    console.error(`${yellow}Supported platforms:${reset}`);
    console.error(`  - macOS (arm64, x64)`);
    console.error(`  - Linux (x64, arm64)`);
    console.error(`  - Windows (x64)`);
    console.error(
      `\n${cyan}Manual installation:${reset} https://github.com/superhighfives/comma-cli/releases`
    );
    process.exit(1);
  }

  console.log(
    `${cyan}comma-cli:${reset} Installing platform package ${packageName}...`
  );

  exec(`npm install ${packageName}`, (error, stdout, stderr) => {
    if (error) {
      console.error(
        `${red}✗${reset} Failed to install ${packageName}: ${error.message}`
      );
      console.error(stderr);
      process.exit(1);
    }

    console.log(`${green}✓${reset} Successfully installed ${packageName}`);
  });
}

// Only run if this is being executed directly (postinstall)
if (require.main === module) {
  installPlatformPackage();
}

module.exports = { getPlatformPackage };
