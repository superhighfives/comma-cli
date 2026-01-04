#!/usr/bin/env bun
import { mkdirSync, rmSync, cpSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform, arch } from "node:os";
import { $ } from "bun";

// ANSI colors
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const dim = "\x1b[2m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

// Host platform detection
const hostPlatform = platform();
const hostArch = arch();

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = join(repoRoot, "package.json");
const mainPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = mainPackage.version;

console.log(`\n${bold}${cyan}+----------------------------------------+${reset}`);
console.log(`${bold}${cyan}|${reset}  Building ${bold}comma-cli${reset} v${version}           ${bold}${cyan}|${reset}`);
console.log(`${bold}${cyan}+----------------------------------------+${reset}\n`);

// Platform configurations
type PlatformConfig = {
  target: string;
  os: string;
  arch: string;
  ext: string;
};

const platformMap: Record<string, PlatformConfig> = {
  "linux-x64": {
    target: "bun-linux-x64",
    os: "linux",
    arch: "x64",
    ext: "",
  },
  "linux-arm64": {
    target: "bun-linux-arm64",
    os: "linux",
    arch: "arm64",
    ext: "",
  },
  "darwin-arm64": {
    target: "bun-darwin-arm64",
    os: "darwin",
    arch: "arm64",
    ext: "",
  },
  "darwin-x64": {
    target: "bun-darwin-x64",
    os: "darwin",
    arch: "x64",
    ext: "",
  },
  "win32-x64": {
    target: "bun-windows-x64",
    os: "windows",
    arch: "x64",
    ext: ".exe",
  },
};

// Parse CLI arguments
const args = process.argv.slice(2);
const argTargetIndex = args.findIndex((arg) => arg === "--target" || arg === "-t");
const flagAll = args.includes("--all") || process.env.TARGETS === "all";

const nextArg = args[argTargetIndex + 1];
const envTargets = process.env.TARGETS;
const requestedTargets: string[] =
  argTargetIndex !== -1 && nextArg
    ? nextArg.split(",").map((t) => t.trim()).filter(Boolean)
    : envTargets && envTargets !== "all"
      ? envTargets.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

const defaultTarget = `${hostPlatform}-${hostArch}`;
const targetKeys = flagAll
  ? Object.keys(platformMap)
  : requestedTargets.length
    ? requestedTargets
    : [defaultTarget];

const targets: Array<{ key: string } & PlatformConfig> = [];
for (const key of targetKeys) {
  const cfg = platformMap[key];
  if (!cfg) {
    console.error(`${red}x${reset} Unsupported target: ${bold}${key}${reset}`);
    console.error(`${dim}Supported:${reset} ${Object.keys(platformMap).join(", ")}`);
    process.exit(1);
  }
  targets.push({ key, ...cfg });
}

console.log(`${dim}Targets:${reset} ${bold}${targets.map((t) => t.key).join(", ")}${reset}\n`);

const outputRoot = process.env.OUTPUT_DIR || "./dist";

try {
  // Clean output directory
  if (existsSync(outputRoot)) {
    console.log(`${yellow}~${reset} Cleaning ${outputRoot}...`);
    rmSync(outputRoot, { recursive: true, force: true });
  }

  for (const targetConfig of targets) {
    const { target, os, arch: archName, ext, key } = targetConfig;
    const outdir = join(outputRoot, `comma-cli-${os}-${archName}`);

    console.log(`${cyan}>${reset} Building ${dim}${target}${reset}...`);
    mkdirSync(outdir, { recursive: true });

    const binaryPath = join(outdir, `comma-cli${ext}`);

    // Use bun build --compile for creating standalone executables
    const buildResult = await $`bun build ./src/index.tsx --compile --minify --target=${target} --outfile=${binaryPath}`.nothrow();

    if (buildResult.exitCode !== 0) {
      console.error(`${red}x${reset} Build failed for ${target}:`);
      console.error(buildResult.stderr.toString());
      process.exit(1);
    }

    // Make binary executable on Unix
    if (!ext) {
      chmodSync(binaryPath, 0o755);
    }

    // Create package.json for the platform-specific package
    const pkgName = `comma-cli-${os}-${archName}`;
    const platformPkg = {
      name: pkgName,
      version,
      description: `${mainPackage.description || "Command-line command manager"} (${os}-${archName} binary)`,
      os: [os === "windows" ? "win32" : os],
      cpu: [archName],
      files: [`comma-cli${ext}`],
      bin: {
        "comma-cli": `comma-cli${ext}`,
      },
    };

    await Bun.write(join(outdir, "package.json"), JSON.stringify(platformPkg, null, 2));

    // Install host binary locally for development
    if (key === defaultTarget) {
      const localBinDir = join(repoRoot, "node_modules", ".bin");
      mkdirSync(localBinDir, { recursive: true });
      const localBinPath = join(localBinDir, `comma-cli${ext}`);
      cpSync(binaryPath, localBinPath);
      if (!ext) chmodSync(localBinPath, 0o755);
      console.log(`${dim}  - Installed to${reset} ${localBinPath}`);
    }

    console.log(`${green}ok${reset} ${bold}Built ${pkgName}${reset}`);
    console.log(`${dim}  - ${binaryPath}${reset}\n`);
  }

  console.log(`\n${green}ok${reset} ${bold}Build complete for ${targets.length} target(s)${reset}\n`);
} catch (err) {
  const error = err as Error;
  console.error(`\n${red}x${reset} ${bold}Build failed${reset}`);
  console.error(`${dim}${error.message}${reset}`);
  if (error.stack) {
    console.error(`\n${dim}${error.stack}${reset}`);
  }
  process.exit(1);
}
