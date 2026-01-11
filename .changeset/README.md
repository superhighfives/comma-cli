# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

## Creating a Changeset

When you make changes that should be released, create a changeset:

```bash
bun run changeset
```

This will prompt you to:
1. Select which packages to bump (for this project, just `comma-cli`)
2. Choose the version bump type:
   - **patch**: Bug fixes, small changes (0.1.0 → 0.1.1)
   - **minor**: New features, backwards compatible (0.1.0 → 0.2.0)
   - **major**: Breaking changes (0.1.0 → 1.0.0)
3. Write a summary of the changes

The changeset file will be created in `.changeset/` and should be committed with your changes.

## Releasing

When you're ready to release:

1. **Version bump** (optional if you want to do it manually):
   ```bash
   bun run version
   ```
   This will:
   - Read all changesets
   - Bump package.json version
   - Generate/update CHANGELOG.md
   - Remove the changeset files

2. **Build and publish**:
   ```bash
   bun run release
   ```
   Or with OTP for 2FA:
   ```bash
   bun run release --otp=123456
   ```

The release script will automatically:
- Apply any pending changesets (if `--skip-version` is not used)
- Build all platform packages
- Publish to npm

## Workflow

1. Make your changes
2. Run `bun run changeset` to create a changeset
3. Commit your changes and the changeset
4. When ready to release, run `bun run release`

## Options

- `--skip-version`: Skip applying changesets (use if you've already run `bun run version`)
- `--skip-build`: Skip building (use if you've already built)
- `--dry-run`: Test the release process without publishing
- `--otp=<code>`: Provide OTP for npm 2FA

