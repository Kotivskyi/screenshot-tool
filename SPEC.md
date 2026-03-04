# take_screenshot — CLI Tool Specification

Implement script `take_screenshot` that builds, launches, and navigates an app to a desired
screen/state via deep link, then captures a screenshot.

---

## Interface
```
take_screenshot --url <deep_link_url> [OPTIONS]

Options:
  --url <url>         Deep link URL with schema, screen path, and state params (required)
  --output <path>     Full path for the output screenshot file (default: ./screenshots/{datetime}_screenshot.png)
  --timeout <ms>      Max wait time for screen to settle after navigation (default: 3000ms)
  --no-build          Skip build step, only launch app
  --no-restart        Skip relaunching app if already running; navigate in existing instance,
                      and leave app running after screenshot is taken
  --help              Print usage, list registered screens/states from screens.yaml, and exit

Exit codes:
  0   Success
  1   App build or launch error
  2   Navigation or deep link error
  3   Screenshot capture error
  4   Timeout exceeded
```

---

## Deep Link Contract

Screens and states are NOT hardcoded in the script. They are registered in `screens.yaml`.
The `--url` parameter is a deep link URL with schema, screen path, and optional query params:
```
myapp://screen-name?state=state-name&param1=value1
```

`screens.yaml` defines valid screens, their deep link paths, supported states,
and any required or optional parameters:
```yaml
schema: myapp://
screens:
  - name: home
    path: home
    states:
      - name: default
      - name: loading
      - name: error
        params:
          - name: error_code
            required: false
            default: "500"

  - name: profile
    path: profile
    states:
      - name: default
        params:
          - name: user_id
            required: true
      - name: empty
```

The `--help` output must print all registered screens, states, and params from `screens.yaml`.

---

## Platform Support

The script must support platform-specific parameters when the target platform requires them.
Platform-specific parameters are passed as additional named arguments alongside the standard
interface and must not conflict with standard parameter names.

Platform-specific parameters may be required or optional depending on the platform.
They must be defined and documented — either in `--help` output or in a companion
configuration file — so that the caller knows what parameters are available and which
are required for a given platform.

If a required platform-specific parameter is missing or an unrecognized value is provided,
the script must print a clear error and return a non-zero exit code.

The core interface (`--url`, `--output`, `--timeout`, `--no-build`, `--no-restart`) remains
identical across all platforms. Only execution mechanics (build, launch, deep link invocation,
screenshot capture, termination) are platform-specific.

---

## Behavior

1. **Build** — Build the app unless `--no-build` is passed
2. **Launch** — Launch the app unless `--no-restart` is passed and an instance is already running
3. **Navigate** — Open the deep link URL, routing app to the target screen and state
4. **Settle** — Wait up to `--timeout` ms for the screen to finish rendering
5. **Screenshot** — Capture screenshot using a platform-appropriate native tool
6. **Save** — Write screenshot to `--output` path (or default path); overwrite if file exists.
              Print the absolute path of the saved screenshot to stdout.
7. **Teardown** — If `--no-restart` was not passed, terminate the app after the screenshot is taken.
                  If `--no-restart` was passed, leave the app running.
8. **Exit** — Return exit code 0 on success, or appropriate non-zero code on failure.
              On error, do not print a screenshot path.

---

## Screenshot Tool

Use any platform-native or technology-appropriate tool that produces a correct,
full-resolution screenshot of the rendered app screen. The implementation is not
prescribed, but correctness must be verified by the screenshot test cases below.

---

## Deliverables

The following artifacts must be produced alongside the script:

### `SKILL.md` — Coding Agent Usage Guide
A companion `SKILL.md` file must be created that explains how a coding agent can use the
`take_screenshot` script programmatically. It must cover:

- How to invoke the script with correct parameters
- How to read and interpret the stdout output (screenshot path on success, error on failure)
- How to handle exit codes and map them to failure categories
- How to discover available screens, states, and parameters from `screens.yaml`
- How to pass platform-specific parameters when required
- At least two concrete invocation examples covering different screens and states
- How to verify that a screenshot was successfully produced
- A maintenance rule stating that `screens.yaml` must be updated whenever new screens,
  states, or parameters are added to the app — without this update the script will not
  recognize them and will return an error

---

## Mandatory Test Cases

### Navigation & Screenshot
- [ ] Take screenshot of a screen using a valid `--url` deep link
- [ ] Take screenshot of the same screen in `{state1}` (at least 2 states implemented)
- [ ] Take screenshot of the same screen in `{state2}`
- [ ] Take screenshot of a screen with a required URL parameter (e.g. `?user_id=42`)

### Build & Launch
- [ ] Script builds and launches app from cold (no running instance)
- [ ] Script works when app instance is already running (`--no-restart` navigates in-place)
- [ ] `--no-build` skips build and only launches + navigates
- [ ] Script handles app build/launch errors: writes error to stdout, returns non-zero exit code

### Output Path
- [ ] Screenshot is saved to default path `./screenshots/{datetime}_screenshot.png`
- [ ] Multiple runs produce non-conflicting files (unique datetime stamps)
- [ ] `--output <path>` saves screenshot to the specified path
- [ ] `--output <path>` overwrites an existing file at that path without error
- [ ] On success, script prints the absolute path of the saved screenshot to stdout
- [ ] On error, no screenshot path is printed to stdout

### Screenshot Correctness
- [ ] Screenshot file is a valid image (non-zero byte size, parseable as PNG)
- [ ] Screenshot visually reflects the correct screen (manual or pixel-diff verified)
- [ ] Screenshot visually reflects the correct state (manual or pixel-diff verified)

### Timeout
- [ ] `--timeout` causes script to abort and return non-zero exit code if screen does not settle in time

### Teardown
- [ ] Without `--no-restart`: app process is terminated after screenshot is taken
- [ ] With `--no-restart`: app remains running after screenshot is taken
- [ ] On error: app is still terminated if it was launched by the script (no orphan processes)

### Platform Parameters
- [ ] Platform-specific parameters are documented in `--help` output or companion configuration
- [ ] Missing required platform-specific parameter produces a clear error and non-zero exit code
- [ ] Unrecognized platform-specific parameter value produces a clear error and non-zero exit code

### Deliverables
- [ ] `SKILL.md` exists alongside the script
- [ ] `SKILL.md` covers all invocation parameters including platform-specific ones
- [ ] `SKILL.md` includes at least two concrete invocation examples
- [ ] `SKILL.md` documents all exit codes and their meanings
- [ ] `SKILL.md` explains how to discover available screens and states
- [ ] `SKILL.md` documents the maintenance rule: `screens.yaml` must be kept in sync
      with the app whenever screens, states, or parameters are added or changed

### Help & Discovery
- [ ] `--help` prints all screens, states, and parameters from `screens.yaml`
- [ ] Running with an unregistered screen/state in `--url` prints a clear error message

---

## Error Handling

All errors must be written to stdout and result in a non-zero exit code.
The exit code must indicate the failure category (see Interface section above).
On any error, if the app was launched by the script, it must be terminated before exit.