# 🤖 CodeDoc Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-orange.svg)](https://anthropic.com)
[![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)](package.json)

> **Automated Codebase Documentation & Refactoring Agent** — A CLI tool that reads an entire GitHub repository or local codebase, maps dependency trees, and uses Claude AI to generate beautiful documentation, refactoring reports, and interactive dependency visualizations.

---

## ✨ Features

- **🔍 Deep Codebase Analysis** — Scans every file, extracts symbols, imports, and code patterns
- **📚 AI-Powered Documentation** — Generates project overview, per-file docs, API reference, and README using Claude AI
- **🔧 Smart Refactoring Suggestions** — Detects code smells, circular dependencies, long functions, missing error handling, and more
- **🗺️ Interactive Dependency Map** — Beautiful D3.js visualization of module relationships with zoom/pan/hover
- **📊 Code Health Report** — Grades your codebase from A–F based on issue severity
- **🐙 GitHub Integration** — Analyzes any public GitHub repo directly from its URL
- **🎨 Beautiful HTML Reports** — Dark-themed, professional output ready to share

---

## 📦 Installation

### Prerequisites
- **Node.js 18+**
- **Git** (for GitHub URL support)
- **Anthropic API Key**

### Install globally
```bash
npm install -g codedoc-agent
```

### Or run from source
```bash
git clone https://github.com/your-org/codedoc-agent.git
cd codedoc-agent
npm install
npm link
```

### Set API key
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Add to `~/.bashrc` or `~/.zshrc` to persist.

---

## 🚀 Quick Start

### Analyze a GitHub repo
```bash
codedoc analyze https://github.com/expressjs/express
```

### Analyze a local project
```bash
codedoc analyze ./my-project
```

### Open the generated report
```bash
open codedoc-output/index.html
```

---

## 📖 Usage

### Commands

#### `codedoc analyze <repo>` — Full Analysis
Runs analysis, documentation, dependency mapping, and refactoring suggestions together.

```bash
codedoc analyze <repo-path-or-github-url> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./codedoc-output` | Output directory |
| `-f, --format <format>` | `markdown` | Output format: `markdown` \| `html` \| `json` |
| `--no-refactor` | — | Skip refactoring suggestions |
| `--no-deps` | — | Skip dependency map generation |
| `--depth <n>` | `10` | Max directory depth |
| `--ignore <patterns>` | `node_modules,dist` | Comma-separated glob patterns to ignore |
| `--model <model>` | `claude-sonnet-4-6` | Anthropic model |
| `-c, --config <file>` | `.codedocrc.json` | Config file path |

**Examples:**
```bash
# Full analysis of a GitHub repo
codedoc analyze https://github.com/fastify/fastify -o ./fastify-docs

# Local project, skip refactoring
codedoc analyze ./my-app --no-refactor

# Deep analysis with custom ignore
codedoc analyze . --ignore "node_modules,dist,*.test.js" --depth 15
```

---

#### `codedoc docs <repo>` — Documentation Only
Generates documentation without refactoring analysis.

```bash
codedoc docs ./my-project -o ./docs-output
```

---

#### `codedoc refactor <repo>` — Refactoring Analysis Only
Analyzes code quality and generates a refactoring report.

```bash
codedoc refactor ./my-project --severity medium
```

| Option | Default | Description |
|--------|---------|-------------|
| `--severity <level>` | `low` | Minimum severity: `low` \| `medium` \| `high` |

---

#### `codedoc deps <repo>` — Dependency Map Only
Generates the dependency visualization.

```bash
codedoc deps ./my-project
```

---

## ⚙️ Configuration File

Create `.codedocrc.json` in your project root:

```json
{
  "output": "./docs",
  "format": "markdown",
  "model": "claude-sonnet-4-6",
  "depth": 12,
  "ignore": "node_modules,dist,*.min.js,coverage",
  "refactor": true,
  "deps": true,
  "severity": "medium"
}
```

---

## 📁 Output Structure

```
codedoc-output/
├── index.html                  # 🎨 Main interactive report
├── dependency-map.html         # 🗺️ Interactive D3 dependency visualization
├── dep-graph.json              # Raw dependency graph data
├── analysis.json               # Full structured analysis data
├── refactoring-report.json     # Refactoring data (JSON)
└── docs/
    ├── PROJECT_OVERVIEW.md     # AI-generated project overview
    ├── README_GENERATED.md     # AI-generated README
    ├── FILE_DOCUMENTATION.md   # Per-file documentation
    ├── API_REFERENCE.md        # API reference (JS/TS projects)
    ├── DEPENDENCY_MAP.md       # Dependency report with Mermaid diagram
    └── REFACTORING_REPORT.md   # Full refactoring suggestions
```

---

## 🏗️ Architecture

```
codedoc-agent/
├── src/
│   ├── cli/
│   │   └── index.js            # CLI entry point (Commander.js)
│   ├── analyzers/
│   │   ├── repoAnalyzer.js     # File scanning, symbol extraction
│   │   └── dependencyMapper.js # Dependency graph construction
│   ├── generators/
│   │   ├── docGenerator.js     # AI documentation generation
│   │   ├── refactorGenerator.js# AI refactoring suggestions
│   │   └── reportExporter.js   # HTML/Markdown output
│   └── utils/
│       ├── config.js           # Configuration loading
│       ├── validator.js        # Repo validation + GitHub clone
│       └── display.js          # Terminal output formatting
├── docs/                       # Project documentation
├── tests/                      # Test suite
├── examples/                   # Example outputs
├── package.json
└── .codedocrc.json             # Default config
```

---

## 🌍 Supported Languages

| Language | Docs | Refactor | Imports |
|----------|------|----------|---------|
| JavaScript | ✅ | ✅ | ✅ |
| TypeScript | ✅ | ✅ | ✅ |
| Python | ✅ | ✅ | ✅ |
| Java | ✅ | ✅ | ✅ |
| Go | ✅ | ✅ | ✅ |
| Rust | ✅ | ✅ | ✅ |
| Ruby | ✅ | ✅ | — |
| PHP | ✅ | ✅ | — |
| C/C++ | ✅ | ✅ | — |
| C# | ✅ | ✅ | — |

---

## 🔒 Privacy

- Your code is sent to Anthropic's API for AI analysis. Review [Anthropic's privacy policy](https://www.anthropic.com/privacy).
- Use `--no-refactor` and generate docs only if you want to minimize data sent.
- Cloned GitHub repos are stored in your OS temp directory and can be cleaned up with `rm -rf /tmp/codedoc-*`.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © 2024 CodeDoc Agent
