# take_screenshot — Coding Agent Usage Guide

## Overview

`take_screenshot` is a CLI tool that navigates the Football Booking admin dashboard to any screen and state, then captures a screenshot. It uses Playwright to launch a headless browser, mocks all API responses (no backend needed), and saves a PNG image.

## Invocation

```bash
npx tsx frontend/screenshot-tool/take_screenshot.ts --url <deep_link_url> [OPTIONS]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--url <url>` | Deep link URL (required) | — |
| `--output <path>` | Output screenshot file path | `./screenshots/{datetime}_screenshot.png` |
| `--timeout <ms>` | Max wait for screen to settle | `3000` |
| `--device <device>` | Viewport: `desktop`, `tablet`, `mobile` | `desktop` |
| `--no-build` | Skip `npm run build` step | — |
| `--no-restart` | Reuse running app; leave it running after | — |
| `--help` | Print usage and all screens/states | — |

### Deep Link Format

```
myapp://<screen-name>?state=<state>&<param>=<value>
```

- `screen-name` — registered screen from `screens.yaml`
- `state` — one of the screen's registered states (defaults to `default`)
- Additional query params (e.g., `id=abc123`) for screens that require them

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — screenshot path printed to stdout |
| 1 | Build or server launch failure |
| 2 | Invalid deep link, unknown screen/state, missing params, or navigation error |
| 3 | Screenshot capture failure |
| 4 | Settle timeout exceeded |

## Reading Output

- **On success** (exit 0): stdout contains the **absolute path** to the saved PNG file, one line.
- **On failure** (exit != 0): stdout contains an error message. No screenshot path is printed.
- Informational messages (build progress, server start) go to **stderr**, not stdout.

## Examples

### 1. Screenshot of login page (default state)

```bash
npx tsx frontend/screenshot-tool/take_screenshot.ts \
  --url "myapp://login" \
  --no-build --no-restart
```

### 2. Dashboard in loading state with mobile viewport

```bash
npx tsx frontend/screenshot-tool/take_screenshot.ts \
  --url "myapp://dashboard?state=loading" \
  --device mobile \
  --no-build --no-restart
```

### 3. Slot details with specific ID

```bash
npx tsx frontend/screenshot-tool/take_screenshot.ts \
  --url "myapp://slot-details?id=slot-1" \
  --output ./my-screenshot.png \
  --no-build --no-restart
```

### 4. Login error state

```bash
npx tsx frontend/screenshot-tool/take_screenshot.ts \
  --url "myapp://login?state=error" \
  --no-build --no-restart
```

### 5. Users list in empty state

```bash
npx tsx frontend/screenshot-tool/take_screenshot.ts \
  --url "myapp://users?state=empty" \
  --no-build --no-restart
```

## Discovering Screens and States

All available screens, states, and parameters are defined in:

```
frontend/screenshot-tool/screens.yaml
```

You can also run `--help` to print them:

```bash
npx tsx frontend/screenshot-tool/take_screenshot.ts --help
```

This outputs every screen with its path, auth requirement, states, and parameters.

## Verifying a Screenshot

1. Check exit code is `0`
2. Read the path from stdout
3. Verify the file exists and is non-zero bytes
4. Optionally open/inspect the PNG to confirm visual correctness

```bash
OUTPUT=$(npx tsx frontend/screenshot-tool/take_screenshot.ts --url "myapp://dashboard" --no-build --no-restart)
if [ $? -eq 0 ] && [ -s "$OUTPUT" ]; then
  echo "Screenshot saved: $OUTPUT"
else
  echo "Screenshot failed"
fi
```

## Maintenance Rule

**`screens.yaml` must be kept in sync with the app.** Whenever screens, states, or parameters are added, removed, or changed in the React app, `screens.yaml` must be updated accordingly. Without this update, the tool will reject unregistered screens/states and return exit code 2.

The relevant source of truth for routes is `frontend/src/App.tsx`.
