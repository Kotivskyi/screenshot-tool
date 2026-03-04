# Screenshot Tool

A CLI tool that builds, launches, and navigates an app to a desired screen/state via deep link, then captures a screenshot.

> [!NOTE]
> This is a **specification-only** repository. There is no reference implementation — just a spec. You bring the implementation.

## How It Works

This repo publishes [`SPEC.md`](SPEC.md) — a complete, self-contained specification for a screenshot automation tool. Instead of shipping code, we ship the contract. You use your favorite coding agent to build it in your codebase, in your language, for your platform.

## Getting Started

### Option 1: Tell your coding agent to build it

Point your coding agent (Claude Code, Cursor, Copilot, Codex, etc.) at the spec:

```
Build a screenshot tool following the specification in SPEC.md.
Target platform: [iOS / Android / Web / Desktop].
```

The agent reads the spec and produces a working implementation tailored to your project.

### Option 2: Read the spec yourself

Open [`SPEC.md`](SPEC.md) and implement it manually. The spec covers:

- **Interface** — CLI arguments, flags, exit codes
- **Deep Link Contract** — `screens.yaml` registry for screens, states, and params
- **Platform Support** — Platform-specific parameters alongside a universal core interface
- **Behavior** — Build → Launch → Navigate → Settle → Screenshot → Save → Teardown → Exit
- **Deliverables** — `SKILL.md` companion file for coding agent integration
- **Test Cases** — Comprehensive checklist covering navigation, build/launch, output, correctness, timeout, teardown, platform params, and help/discovery

## Why Spec-Driven?

Every mobile/desktop project has different build systems, simulators, deep link schemas, and screenshot tooling. A single implementation can't cover all of them. A spec can.

- **Language-agnostic** — Implement in Bash, Python, Swift, Kotlin, TypeScript, or anything else
- **Platform-agnostic** — The core interface is identical; only execution mechanics change per platform
- **Agent-friendly** — Coding agents excel at turning precise specs into working code
- **Your codebase, your rules** — The implementation lives in your repo, not ours

## License

Apache-2.0
