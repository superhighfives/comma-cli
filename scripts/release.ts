#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "node:path";
import { arch, platform } from "node:os";
import { chmodSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ANSI colors
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const dim = "\x1b[2m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repoRoot);

let pkg = JSON.parse(await Bun.file("package.json").text());
let version = pkg.version;
const hostKey = `${platform()}-${arch()}`;

// CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipBuild = args.includes("--skip-build");
const skipVersion = args.includes("--skip-version");
const tagArgIndex = args.findIndex((arg) => arg === "--tag");
const tag =
  tagArgIndex !== -1 && args[tagArgIndex + 1]
    ? args[tagArgIndex + 1]
    : process.env.NPM_TAG || "latest";
// Handle --otp=<value> or --otp <value>
let otp: string | undefined;
const otpArgIndex = args.findIndex((arg) => arg.startsWith("--otp"));
if (otpArgIndex !== -1) {
  const otpArg = args[otpArgIndex];
  if (otpArg.includes("=")) {
    // Format: --otp=596429
    otp = otpArg.split("=")[1];
  } else if (args[otpArgIndex + 1]) {
    // Format: --otp 596429
    otp = args[otpArgIndex + 1];
  }
}

const log = (msg: string) => console.log(`${dim}[release]${reset} ${msg}`);

console.log(`\n${bold}${cyan}+----------------------------------------+${reset}`);
console.log(`${bold}${cyan}|${reset}  Releasing ${bold}comma-cli${reset} v${version}         ${bold}${cyan}|${reset}`);
console.log(`${bold}${cyan}+----------------------------------------+${reset}\n`);

log(`Version: ${bold}${version}${reset}`);
log(`Tag: ${bold}${tag}${reset}`);
log(`OTP: ${otp ? `${green}provided${reset}` : `${dim}not provided${reset}`}`);
log(`Dry run: ${dryRun ? `${yellow}yes${reset}` : "no"}`);
log(`Build: ${skipBuild ? `${yellow}skip${reset}` : "run"}`);
log(`Version bump: ${skipVersion ? `${yellow}skip${reset}` : "run"}`);
console.log();

// Check for NPM token
const npmToken = process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN;
if (!npmToken && !dryRun) {
  console.error(`${red}x${reset} NPM token not provided (NPM_TOKEN or NODE_AUTH_TOKEN)`);
  process.exit(1);
}

// Create .npmrc for publishing
const npmrcPath = join(repoRoot, ".npmrc.publish");
if (npmToken) {
  await Bun.write(npmrcPath, `//registry.npmjs.org/:_authToken=${npmToken}\n`);
  chmodSync(npmrcPath, 0o600);
}

// Helper to run commands
const run = async (cmd: string, cwd = repoRoot): Promise<void> => {
  log(`${dim}$ ${cmd}${reset}`);
  const proc = Bun.spawn(["bash", "-c", cmd], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed with exit code ${exitCode}: ${cmd}`);
  }
};

// Check for changesets and apply version bumps
if (!skipVersion) {
  const changesetDir = join(repoRoot, ".changeset");
  const changesetFiles = existsSync(changesetDir)
    ? readdirSync(changesetDir).filter((f) => f.endsWith(".md") && f !== "README.md")
    : [];
  
  if (changesetFiles.length > 0) {
    log(`${cyan}>${reset} Found ${changesetFiles.length} changeset(s), applying version bumps...`);
    try {
      await run("bunx changeset version");
      // Reload package.json to get updated version
      pkg = JSON.parse(await Bun.file("package.json").text());
      const newVersion = pkg.version;
      if (newVersion !== version) {
        log(`${green}ok${reset} Version bumped from ${version} to ${newVersion}`);
        version = newVersion;
        // Update the header with new version
        console.log(`\n${bold}${cyan}+----------------------------------------+${reset}`);
        console.log(`${bold}${cyan}|${reset}  Releasing ${bold}comma-cli${reset} v${version}         ${bold}${cyan}|${reset}`);
        console.log(`${bold}${cyan}+----------------------------------------+${reset}\n`);
      } else {
        log(`${yellow}~${reset} No version bump needed`);
      }
    } catch (error) {
      console.error(`${red}x${reset} Failed to apply changesets: ${error}`);
      process.exit(1);
    }
  } else {
    log(`${dim}~${reset} No changesets found, skipping version bump`);
  }
} else {
  log(`${dim}~${reset} Skipping version bump (--skip-version)`);
}

// Build all targets if not skipped
if (!skipBuild) {
  log(`${cyan}>${reset} Building all targets...`);
  await run("bun run scripts/build.ts --all");
}

// Find all platform packages in dist/
const distDir = join(repoRoot, "dist");
if (!existsSync(distDir)) {
  console.error(`${red}x${reset} Missing dist directory. Did the build step succeed?`);
  process.exit(1);
}

const platformPackages = readdirSync(distDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("comma-cli-"))
  .map((d) => ({
    name: d.name,
    dir: join(distDir, d.name),
  }));

if (platformPackages.length === 0) {
  console.error(`${red}x${reset} No platform packages found in ${distDir}`);
  process.exit(1);
}

log(`Found ${platformPackages.length} platform package(s)`);

// Sync version in all platform packages to match main package
log(`${cyan}>${reset} Syncing versions in platform packages...`);
for (const { name, dir } of platformPackages) {
  const pkgJsonPath = join(dir, "package.json");
  if (existsSync(pkgJsonPath)) {
    const platformPkg = JSON.parse(await Bun.file(pkgJsonPath).text());
    if (platformPkg.version !== version) {
      platformPkg.version = version;
      await Bun.write(pkgJsonPath, JSON.stringify(platformPkg, null, 2));
      log(`${dim}  - Updated ${name} to v${version}${reset}`);
    }
  }
}

// Make binaries executable
for (const { name, dir } of platformPackages) {
  if (!name.includes("windows")) {
    const binPath = join(dir, "comma-cli");
    if (existsSync(binPath)) {
      chmodSync(binPath, 0o755);
    }
  }
}

// Smoke test the host binary
const hostPkg = platformPackages.find(({ name }) =>
  name.includes(hostKey.replace("win32", "windows").replace("-", "-"))
);
if (hostPkg) {
  const binName = hostPkg.name.includes("windows") ? "comma-cli.exe" : "comma-cli";
  const binPath = join(hostPkg.dir, binName);
  if (existsSync(binPath)) {
    try {
      log(`${cyan}>${reset} Smoke testing host binary...`);
      await run(`${binPath} --version`);
      log(`${green}ok${reset} Smoke test passed`);
    } catch {
      console.warn(`${yellow}!${reset} Host binary smoke test failed`);
    }
  }
}

// Publish helper
const publishPackage = async (
  dir: string,
  displayName: string
): Promise<"published" | "skipped"> => {
  const pkgJson = JSON.parse(await Bun.file(join(dir, "package.json")).text());
  const pkgName = pkgJson.name;
  const pkgVersion = pkgJson.version;

  // Check if already published
  try {
    const result = await $`npm view ${pkgName}@${pkgVersion} version 2>/dev/null`.quiet().nothrow();
    const publishedVersion = result.stdout.toString().trim();
    if (publishedVersion === pkgVersion) {
      log(`${yellow}~${reset} Skipping ${displayName}@${pkgVersion} (already published)`);
      return "skipped";
    }
  } catch {
    // Not published yet, continue
  }

  const publishCmd = [
    "npm publish",
    "--access public",
    `--tag ${tag}`,
    npmToken ? `--userconfig ${npmrcPath}` : "",
    otp ? `--otp ${otp}` : "",
    dryRun ? "--dry-run" : "",
  ]
    .filter(Boolean)
    .join(" ");

  log(`${cyan}>${reset} Publishing ${displayName}@${pkgVersion}...`);

  try {
    await run(publishCmd, dir);
    log(`${green}ok${reset} ${dryRun ? "Dry-run" : "Published"} ${displayName}@${pkgVersion}`);
    return "published";
  } catch (error: unknown) {
    const errorStr = String(error);
    if (
      errorStr.includes("Cannot publish over previously published version") ||
      errorStr.includes("You cannot publish over the previously published versions")
    ) {
      log(`${yellow}~${reset} Skipping ${displayName}@${pkgVersion} (already published)`);
      return "skipped";
    }
    throw error;
  }
};

// Publish results tracking
const results = {
  published: [] as string[],
  skipped: [] as string[],
};

console.log();
log(`${bold}Publishing platform packages...${reset}`);

// Publish platform packages
for (const { name, dir } of platformPackages) {
  const result = await publishPackage(dir, name);
  if (result === "published") {
    results.published.push(name);
  } else {
    results.skipped.push(name);
  }
}

console.log();
log(`${bold}Publishing main package...${reset}`);

// Publish main package
const mainResult = await publishPackage(repoRoot, pkg.name);
if (mainResult === "published") {
  results.published.push(pkg.name);
} else {
  results.skipped.push(pkg.name);
}

// Summary
console.log();
console.log(`${bold}${cyan}+----------------------------------------+${reset}`);
console.log(`${bold}${cyan}|${reset}  Release Summary                       ${bold}${cyan}|${reset}`);
console.log(`${bold}${cyan}+----------------------------------------+${reset}`);
console.log();

if (results.published.length > 0) {
  log(`${green}Published (${results.published.length}):${reset}`);
  for (const name of results.published) {
    console.log(`  ${green}+${reset} ${name}`);
  }
}

if (results.skipped.length > 0) {
  log(`${yellow}Skipped (${results.skipped.length}):${reset}`);
  for (const name of results.skipped) {
    console.log(`  ${yellow}~${reset} ${name}`);
  }
}

console.log();
log(`${green}ok${reset} ${bold}Release complete${reset}\n`);
