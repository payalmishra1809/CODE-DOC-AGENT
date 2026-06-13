# CodeDoc Agent — Project Synopsis

## Project Title
**CodeDoc Agent: Automated Codebase Documentation & Refactoring Agent**

---

## Overview

CodeDoc Agent is a developer CLI tool (and optionally a GitHub App) that automates one of the most tedious yet critical tasks in software development: documenting and reviewing an entire codebase. By combining static code analysis with the reasoning power of Claude AI (Anthropic), it transforms any repository — local or on GitHub — into structured, readable documentation and actionable refactoring recommendations, all in a single command.

---

## Problem Statement

Modern software projects grow fast. Teams ship features at pace, rarely stop to write documentation, and accumulate technical debt invisibly. The result:

- **New developers** struggle to onboard — there are no docs, no architecture guides.
- **Reviewers** spend hours tracing import chains trying to understand what a module does.
- **Code quality** degrades silently — nobody noticed the 600-line utility file with 4 levels of nesting.
- **Existing tools** are either too lightweight (linters) or too expensive/complex (enterprise platforms).

---

## Solution

CodeDoc Agent solves this with a four-step pipeline:

1. **Scan** — Walks the entire directory tree (respecting `.gitignore`-style patterns), reads every source file, and extracts symbols (functions, classes, exports), imports, line counts, and basic code issues.

2. **Map** — Builds a directed dependency graph across all modules, detecting circular dependencies, entry points, leaf modules, and high-coupling hubs. The graph is rendered as an interactive D3.js visualization.

3. **Document** — Sends structured file metadata and code snippets to Claude AI to generate: a project overview, per-file documentation, a full README, and an API reference.

4. **Refactor** — Asks Claude AI to analyze the most complex files for code smells, anti-patterns, and improvement opportunities. Augments AI findings with static analysis (circular deps, large files, missing tests).

All output is saved to a self-contained output directory with both Markdown files (for Git-based documentation workflows) and a polished HTML report (for sharing with stakeholders).

---

## Key Features

| Feature | Description |
|---------|-------------|
| GitHub URL support | Clone and analyze any public repo with one command |
| Language support | JavaScript, TypeScript, Python, Java, Go, Rust, Ruby, PHP, C/C++, C# |
| AI documentation | Claude AI generates project overview, file docs, README, API reference |
| Dependency mapping | D3.js interactive visualization, Mermaid diagram, circular dep detection |
| Refactoring engine | Code health grading (A–F), severity-ranked suggestions with before/after |
| HTML report | Dark-themed, self-contained, shareable report with all data |
| JSON export | Machine-readable output for CI/CD integration |
| Config file | `.codedocrc.json` for project-specific defaults |

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 18+ |
| CLI framework | Commander.js |
| Terminal UX | Chalk, Ora |
| AI engine | Anthropic Claude API (`claude-sonnet-4-6`) |
| Frontend | Vanilla JS, D3.js (dependency viz) |
| File analysis | Custom static analyzer (AST-free, regex-based) |
| Glob matching | Micromatch |

---

## Target Users

- **Individual developers** who want to quickly document a project before open-sourcing it
- **Engineering teams** onboarding new members to a legacy codebase
- **Tech leads** doing a code quality audit before a major refactor
- **Open-source maintainers** who want auto-generated docs for their repos

---

## Example Output

Running `codedoc analyze https://github.com/expressjs/express` produces:

- `index.html` — interactive dashboard with metrics, health grade, top refactoring suggestions
- `dependency-map.html` — D3 force-graph of all Express modules with zoom/hover
- `docs/PROJECT_OVERVIEW.md` — AI-written architectural overview of Express
- `docs/FILE_DOCUMENTATION.md` — documentation for all 30+ Express source files
- `docs/README_GENERATED.md` — fresh README ready to use
- `docs/REFACTORING_REPORT.md` — issues like long files, missing error handling, etc.

---

## Limitations & Scope

- **API cost** — Each run makes multiple Anthropic API calls; large repos with 100+ files may incur meaningful token costs.
- **Private repos** — GitHub private repos require a token; local path analysis works without network.
- **Language coverage** — Import resolution is most accurate for JS/TS; other languages use simpler patterns.
- **No AST parsing** — The analyzer uses regex-based extraction rather than full AST parsing. This is fast but less precise than tools like ESLint or tree-sitter.

---

## Future Roadmap

- GitHub App integration (auto-run on pull requests)
- VSCode extension for inline refactoring suggestions
- AST-based analysis for deeper precision
- Support for monorepos and workspaces
- Incremental analysis (only re-analyze changed files)
- Team collaboration mode with shared reports

---

*Built with ❤️ using Claude AI by Anthropic*
