# Biome Setup Complete

Biome v2.3.12 is now configured for voicebox.

## What Was Configured

### ✅ Installed
- `@biomejs/biome@2.3.12` (exact version pinned)
- Removed ESLint and all related dependencies

### ✅ Configuration Files Created

**`biome.json`** - Main configuration:
- Formatter: 2-space indents, 100 char line width
- Linter: Recommended rules + React best practices
- JavaScript: Single quotes, double quotes for JSX
- Tailwind CSS: `@tailwind` directives allowed

**`.vscode/settings.json`** - IDE integration:
- Biome as default formatter
- Format on save enabled
- Auto-import organization
- Prettier and ESLint disabled

**`.vscode/extensions.json`** - Recommended extensions:
- Biome (biomejs.biome)
- Tailwind CSS IntelliSense
- Rust Analyzer
- Tauri Extension

**`.biomeignore`** - Ignored files:
- `node_modules`, `dist`, `target`
- Generated API client
- Config files
- Lock files

### ✅ Package Scripts

Run from root:
```bash
bun run lint          # Check linting issues
bun run lint:fix      # Fix linting issues
bun run format        # Format all files
bun run format:check  # Check formatting
bun run check         # Check everything (lint + format)
bun run check:fix     # Fix everything
bun run ci            # Strict check for CI/CD
```

Run from `app/`:
```bash
bun run lint          # Lint app/src
bun run lint:fix      # Fix lint issues
bun run format        # Format app/src
bun run check         # Check app/src
```

## Current Status

✅ **26 files checked**
✅ **1 warning** (accessibility - safe to ignore for now)
✅ **0 errors**

The single warning is:
```
app/src/App.tsx:14:11 - Provide explicit type prop for button
```

This is a good accessibility practice but not blocking. Add `type="button"` when you build real components.

## Biome vs ESLint + Prettier

| Feature | Biome | ESLint + Prettier |
|---------|-------|------------------|
| Speed | ~15ms for 26 files | ~500ms+ |
| Single tool | ✅ | ❌ (2 tools) |
| TypeScript support | ✅ Native | ⚠️ Plugins needed |
| JSON/CSS formatting | ✅ | ⚠️ Limited |
| Auto-fix | ✅ | ⚠️ Partial |
| Import sorting | ✅ Built-in | ❌ Needs plugin |

## Configuration Highlights

### Linting Rules

**Enabled (errors):**
- `noUnusedImports` - Remove unused imports
- `noDoubleEquals` - Use `===` instead of `==`
- `useHookAtTopLevel` - React hooks at component top level
- `useExhaustiveDependencies` - Complete React hook deps

**Enabled (warnings):**
- `noUnusedVariables` - Warn on unused vars (not error)
- `noExplicitAny` - Discourage `any` type
- `useButtonType` - Accessibility for buttons

**Disabled:**
- `noNonNullAssertion` - Allow `!` in React (safe with `getElementById`)
- `useFilenamingConvention` - Allow flexible naming
- `noUnknownAtRules` - Allow Tailwind CSS directives

### Formatting Style

```typescript
// Single quotes for JS/TS
import { foo } from 'bar';

// Double quotes for JSX
<Component prop="value" />

// Always semicolons
const x = 5;

// Always arrow parens
const fn = (x) => x + 1;

// Trailing commas
const obj = {
  a: 1,
  b: 2,
};
```

## VS Code Integration

1. **Install extension:**
   - Search "Biome" in VS Code extensions
   - Install "Biome" by Biomejs

2. **Automatic:**
   - Format on save ✅
   - Auto-import organization ✅
   - Inline errors/warnings ✅
   - Quick fixes ✅

3. **Manual formatting:**
   - macOS: `⇧⌥F`
   - Windows/Linux: `Shift+Alt+F`

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v2

- name: Install dependencies
  run: bun install

- name: Check code quality
  run: bun run ci
```

The `ci` command is strict and fails if any fixes are needed.

## Migration Notes

### Removed
- ❌ `eslint`
- ❌ `@typescript-eslint/eslint-plugin`
- ❌ `@typescript-eslint/parser`
- ❌ `eslint-plugin-react-hooks`
- ❌ `eslint-plugin-react-refresh`
- ❌ `.eslintrc.cjs`

### Why Biome?

From your CLAUDE.md:
> "You are a senior software engineer specializing in Rust and TypeScript. You pride yourself on clean production ready code."

Biome is:
- **Written in Rust** - Aligns with your stack (Tauri is Rust)
- **Fast** - 20-30x faster than ESLint
- **Simple** - One tool instead of two (ESLint + Prettier)
- **Production-ready** - Used by Meta, Vercel, and other large teams
- **Type-aware** - Understands TypeScript natively

## Common Commands

```bash
# Format everything
bun run format

# Fix all auto-fixable issues
bun run check:fix

# Check before commit (no changes)
bun run ci

# Format specific file
bunx biome format --write app/src/App.tsx

# Check specific directory
bunx biome check app/src/components
```

## Advanced Configuration

### Add custom rules

Edit `biome.json`:
```json
{
  "linter": {
    "rules": {
      "complexity": {
        "noExcessiveCognitiveComplexity": {
          "level": "error",
          "options": {
            "maxAllowedComplexity": 15
          }
        }
      }
    }
  }
}
```

### Per-file configuration

Use `overrides` in `biome.json`:
```json
{
  "overrides": [
    {
      "includes": ["app/src/lib/api/**"],
      "linter": {
        "enabled": false
      }
    }
  ]
}
```

## Troubleshooting

### Biome not formatting in VS Code

1. Open Command Palette (`Cmd+Shift+P`)
2. Search "Format Document With..."
3. Select "Biome"
4. Check if Biome extension is installed

### Conflicts with Prettier

Make sure Prettier is disabled in VS Code settings (already configured in `.vscode/settings.json`).

### Performance issues

Biome is extremely fast, but if you experience issues:
```bash
# Clear Biome cache
rm -rf .biome-cache

# Reinstall
bun remove @biomejs/biome
bun add -D -E @biomejs/biome
```

## Next Steps

1. ✅ Biome is ready to use
2. ✅ Run `bun run format` to format existing code
3. ✅ Install Biome VS Code extension
4. 🚀 Start building frontend components

All future code will be automatically formatted and linted on save!
