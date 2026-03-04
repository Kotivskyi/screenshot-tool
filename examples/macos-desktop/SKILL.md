# take_screenshot

Build, launch, and capture a screenshot of any registered CMUITestApp scene via deep link URLs.

## Quick Start

```bash
# Capture default state
./take_screenshot --url "cmuitestapp://properties-panel"

# Capture specific state
./take_screenshot --url "cmuitestapp://properties-panel?state=loading"

# Capture with parameters
./take_screenshot --url "cmuitestapp://connection-detail?state=default&connection_id=42"
```

## Usage

```
take_screenshot --url <deep_link_url> [OPTIONS]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--url <url>` | Deep link URL (required) | — |
| `--output <path>` | Output PNG path | `./screenshots/{datetime}_screenshot.png` |
| `--timeout <ms>` | Max wait time for capture | `3000` |
| `--no-build` | Skip xcodebuild step | — |
| `--no-restart` | Keep app running after capture | — |
| `--help` | Show usage and registered screens | — |

### URL Format

```
cmuitestapp://{screen-path}?state={state-name}&{param1}={value1}&{param2}={value2}
```

- **schema**: `cmuitestapp://` (must match `screens.yaml`)
- **screen-path**: Registered screen path (e.g., `properties-panel`)
- **state**: Optional state name; defaults to first state if omitted
- **params**: Key-value pairs for the state (some may be required)

## Screen Discovery

List all registered screens, states, and parameters:

```bash
./take_screenshot --help
```

Or read `screens.yaml` directly at the repo root.

## Output Contract

- **Success (exit 0)**: Prints the absolute path to the PNG on stdout.
- **Error (exit 1-4)**: Prints `Error: <description>` to stdout. No path printed.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — screenshot captured |
| 1 | Build or launch failure |
| 2 | URL validation error (bad schema, unregistered screen, invalid state, missing required param) |
| 3 | Capture failure (output file not produced) |
| 4 | Timeout exceeded |

## Batch Mode

For fast iteration (skip rebuild, keep app alive between captures):

```bash
# First capture — builds and launches
./take_screenshot --url "cmuitestapp://properties-panel" --no-restart

# Subsequent captures — skip build, reuse running app
./take_screenshot --url "cmuitestapp://properties-panel?state=loading" --no-build --no-restart
./take_screenshot --url "cmuitestapp://properties-panel?state=error&error_code=404" --no-build --no-restart

# Clean up
pkill -f CMUITestApp
```

## Verifying a Screenshot

```bash
output=$(./take_screenshot --url "cmuitestapp://properties-panel" --no-build)
if [ $? -eq 0 ] && [ -f "$output" ]; then
    echo "Screenshot saved to: $output"
fi
```

## Requirements

- macOS with Xcode and xcodebuild
- python3 (included with Xcode Command Line Tools)
- CMUITestApp must be buildable via the ConnectionManagerUI workspace

## How It Works

1. Parses the deep link URL and validates against `screens.yaml`
2. Builds CMUITestApp via xcodebuild (unless `--no-build`)
3. Launches the app executable directly with translated CLI args (`--screenshot --scene --state --params --output`)
4. The app renders the scene, captures via `NSView.cacheDisplay`, writes PNG, and exits
5. Script prints the output path on success
