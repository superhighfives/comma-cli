#!/usr/bin/env node

const { spawn } = require("child_process");
const { platform } = require("os");
const { join } = require("path");
const { existsSync } = require("fs");

// Get the platform package name
const { getPlatformPackage } = require("./install.js");

function findPlatformBinary() {
  const packageName = getPlatformPackage();
  if (!packageName) {
    console.error(
      `Error: Unsupported platform ${platform()}-${require("os").arch()}`
    );
    process.exit(1);
  }

  // Determine binary name (Windows has .exe extension)
  const binaryName =
    platform() === "win32" ? "comma-cli.exe" : "comma-cli";

  // Try to find the binary in node_modules
  const possiblePaths = [
    // Installed as dependency
    join(__dirname, "node_modules", packageName, binaryName),
    // Installed globally alongside this package
    join(__dirname, "..", packageName, binaryName),
    // Installed in parent node_modules (when this is a dependency)
    join(__dirname, "..", "..", packageName, binaryName),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  console.error(`Error: Could not find ${packageName} binary.`);
  console.error(`Tried paths:`);
  possiblePaths.forEach((p) => console.error(`  - ${p}`));
  console.error(
    `\nTry reinstalling: npm install -g comma-cli`
  );
  process.exit(1);
}

function run() {
  const binaryPath = findPlatformBinary();

  // Spawn the binary with all arguments passed through
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: "inherit",
    windowsHide: false,
  });

  // Forward exit code
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code || 0);
    }
  });

  // Handle errors
  child.on("error", (err) => {
    console.error(`Error executing comma-cli: ${err.message}`);
    process.exit(1);
  });
}

// Run if executed directly
if (require.main === module) {
  run();
}
