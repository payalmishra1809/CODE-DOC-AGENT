/**
 * Repository Analyzer
 * Scans a local codebase, extracts structure, file metadata, and code snippets.
 */

const fs = require('fs');
const path = require('path');
const micromatch = require('micromatch');

const SUPPORTED_EXTENSIONS = {
  javascript: ['.js', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx'],
  python: ['.py'],
  java: ['.java'],
  go: ['.go'],
  rust: ['.rs'],
  ruby: ['.rb'],
  php: ['.php'],
  cpp: ['.cpp', '.cc', '.cxx', '.h', '.hpp'],
  c: ['.c', '.h'],
  csharp: ['.cs'],
  swift: ['.swift'],
  kotlin: ['.kt'],
  markdown: ['.md', '.mdx'],
  json: ['.json'],
  yaml: ['.yaml', '.yml'],
  shell: ['.sh', '.bash', '.zsh'],
  html: ['.html', '.htm'],
  css: ['.css', '.scss', '.sass', '.less'],
};

const ALL_CODE_EXTENSIONS = Object.values(SUPPORTED_EXTENSIONS).flat();

const DEFAULT_IGNORE = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  '__pycache__/**',
  '*.pyc',
  '.DS_Store',
  'coverage/**',
  '.nyc_output/**',
  'vendor/**',
  '*.min.js',
  '*.min.css',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

/**
 * Walk directory recursively, respecting ignore patterns
 */
function walkDir(dirPath, ignorePatterns, depth, maxDepth) {
  if (depth > maxDepth) return [];

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);

    if (micromatch.isMatch(relativePath, ignorePatterns) ||
        micromatch.isMatch(entry.name, ignorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath, ignorePatterns, depth + 1, maxDepth));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Detect language from file extension
 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  for (const [lang, exts] of Object.entries(SUPPORTED_EXTENSIONS)) {
    if (exts.includes(ext)) return lang;
  }
  return 'unknown';
}

/**
 * Count lines in a file
 */
function countLines(content) {
  return content.split('\n').length;
}

/**
 * Extract imports/requires from a file
 */
function extractImports(content, language) {
  const imports = new Set();

  const patterns = {
    javascript: [
      /require\(['"]([^'"]+)['"]\)/g,
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      /import\s*['"]([^'"]+)['"]/g,
    ],
    typescript: [
      /require\(['"]([^'"]+)['"]\)/g,
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      /import\s*['"]([^'"]+)['"]/g,
    ],
    python: [
      /^import\s+([\w.]+)/gm,
      /^from\s+([\w.]+)\s+import/gm,
    ],
    java: [
      /^import\s+([\w.]+);/gm,
    ],
    go: [
      /"([^"]+)"/g,
    ],
    rust: [
      /use\s+([\w:]+)/g,
    ],
  };

  const langPatterns = patterns[language] || [];
  for (const pattern of langPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.add(match[1]);
    }
  }

  return Array.from(imports);
}

/**
 * Extract function/class/method signatures
 */
function extractSymbols(content, language) {
  const symbols = { functions: [], classes: [], exports: [] };

  const patterns = {
    javascript: {
      functions: [
        /(?:^|\s)(?:async\s+)?function\s+(\w+)\s*\(/gm,
        /(?:^|\s)(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/gm,
        /(?:^|\s)(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?function/gm,
        /^\s{0,4}(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm,
      ],
      classes: [/class\s+(\w+)(?:\s+extends\s+\w+)?/gm],
      exports: [/module\.exports\s*=\s*\{?([^}]+)\}?/g, /export\s+(?:default\s+)?(?:class|function|const)\s+(\w+)/gm],
    },
    python: {
      functions: [/^def\s+(\w+)\s*\(/gm, /^async\s+def\s+(\w+)\s*\(/gm],
      classes: [/^class\s+(\w+)/gm],
      exports: [],
    },
    typescript: {
      functions: [
        /(?:^|\s)(?:async\s+)?function\s+(\w+)\s*\(/gm,
        /(?:^|\s)(?:const|let)\s+(\w+)\s*(?::\s*[\w<>[\]]+)?\s*=\s*(?:async\s*)?\(/gm,
        /^\s{0,4}(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/gm,
      ],
      classes: [/(?:^|\s)(?:abstract\s+)?class\s+(\w+)/gm],
      exports: [/export\s+(?:default\s+)?(?:class|function|const|interface|type)\s+(\w+)/gm],
    },
  };

  const langPatterns = patterns[language] || patterns.javascript;

  for (const [type, typePatterns] of Object.entries(langPatterns)) {
    for (const pattern of typePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1]?.trim();
        if (name && name.length > 1 && !symbols[type].includes(name)) {
          symbols[type].push(name);
        }
      }
    }
  }

  return symbols;
}

/**
 * Detect potential code issues
 */
function detectIssues(content, language, filePath) {
  const issues = [];

  // Long file
  const lines = countLines(content);
  if (lines > 500) {
    issues.push({ type: 'long_file', severity: 'medium', message: `File has ${lines} lines (>500)` });
  }

  // TODO/FIXME/HACK comments
  const todoMatches = content.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG):/gi) || [];
  if (todoMatches.length > 0) {
    issues.push({ type: 'todos', severity: 'low', message: `${todoMatches.length} TODO/FIXME comments` });
  }

  // Console.log in non-test files
  if (['javascript', 'typescript'].includes(language) && !filePath.includes('test')) {
    const consoleLogs = (content.match(/console\.(log|warn|error)\(/g) || []).length;
    if (consoleLogs > 3) {
      issues.push({ type: 'debug_statements', severity: 'low', message: `${consoleLogs} console statements` });
    }
  }

  // Very long functions (crude heuristic)
  const functionBlocks = content.split(/function\s+\w+|=>\s*\{/);
  for (const block of functionBlocks) {
    const blockLines = block.split('\n').slice(0, 100);
    if (blockLines.length >= 100) {
      issues.push({ type: 'long_function', severity: 'medium', message: 'Potential function >100 lines detected' });
      break;
    }
  }

  // Deeply nested code (>4 levels)
  const deepNesting = content.match(/^\s{24,}/gm);
  if (deepNesting && deepNesting.length > 5) {
    issues.push({ type: 'deep_nesting', severity: 'medium', message: 'Deep nesting detected (>4 levels)' });
  }

  return issues;
}

/**
 * Read and analyze a single file
 */
function analyzeFile(filePath, repoRoot) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const relativePath = path.relative(repoRoot, filePath);
  const language = detectLanguage(filePath);
  const lines = countLines(content);
  const imports = extractImports(content, language);
  const symbols = extractSymbols(content, language);
  const issues = detectIssues(content, language, relativePath);
  const size = fs.statSync(filePath).size;

  return {
    path: relativePath,
    absolutePath: filePath,
    language,
    lines,
    size,
    imports,
    symbols,
    issues,
    // Include first 200 lines for AI context
    snippet: content.split('\n').slice(0, 200).join('\n'),
    fullContent: content.length < 50000 ? content : content.slice(0, 50000) + '\n// ... (truncated)',
  };
}

/**
 * Build directory tree structure
 */
function buildDirectoryTree(files, repoRoot) {
  const tree = {};

  for (const file of files) {
    const rel = path.relative(repoRoot, file);
    const parts = rel.split(path.sep);
    let node = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node[part]) node[part] = { _type: 'dir', _children: {} };
      node = node[part]._children;
    }

    const filename = parts[parts.length - 1];
    node[filename] = { _type: 'file', _path: rel };
  }

  return tree;
}

/**
 * Detect project type/framework
 */
function detectProjectType(repoRoot, allFiles) {
  const indicators = {};

  const checkFile = (filename) => {
    return allFiles.some(f => path.basename(f) === filename);
  };

  const readJson = (filename) => {
    try {
      const p = path.join(repoRoot, filename);
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { return null; }
  };

  // Node.js / JavaScript
  if (checkFile('package.json')) {
    const pkg = readJson('package.json');
    indicators.nodejs = true;
    indicators.packageName = pkg?.name || 'unknown';
    indicators.packageVersion = pkg?.version || '0.0.0';
    indicators.description = pkg?.description || '';
    indicators.scripts = pkg?.scripts ? Object.keys(pkg.scripts) : [];

    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    if (deps.react) indicators.framework = 'React';
    else if (deps.vue) indicators.framework = 'Vue';
    else if (deps['@angular/core']) indicators.framework = 'Angular';
    else if (deps.next) indicators.framework = 'Next.js';
    else if (deps.express) indicators.framework = 'Express';
    else if (deps.fastify) indicators.framework = 'Fastify';
    else if (deps.nestjs) indicators.framework = 'NestJS';
  }

  // Python
  if (checkFile('requirements.txt') || checkFile('pyproject.toml') || checkFile('setup.py')) {
    indicators.python = true;
    try {
      const req = fs.readFileSync(path.join(repoRoot, 'requirements.txt'), 'utf-8');
      if (req.includes('django')) indicators.framework = 'Django';
      else if (req.includes('flask')) indicators.framework = 'Flask';
      else if (req.includes('fastapi')) indicators.framework = 'FastAPI';
    } catch { /* ignore */ }
  }

  // Java
  if (checkFile('pom.xml') || checkFile('build.gradle')) {
    indicators.java = true;
    if (checkFile('pom.xml')) {
      try {
        const pom = fs.readFileSync(path.join(repoRoot, 'pom.xml'), 'utf-8');
        if (pom.includes('spring')) indicators.framework = 'Spring';
      } catch { /* ignore */ }
    }
  }

  // Go
  if (checkFile('go.mod')) {
    indicators.go = true;
  }

  // Rust
  if (checkFile('Cargo.toml')) {
    indicators.rust = true;
  }

  // Docker
  if (checkFile('Dockerfile') || checkFile('docker-compose.yml')) {
    indicators.docker = true;
  }

  // CI/CD
  if (allFiles.some(f => f.includes('.github/workflows'))) indicators.githubActions = true;
  if (checkFile('.travis.yml')) indicators.travisCI = true;

  // TypeScript
  if (checkFile('tsconfig.json')) indicators.typescript = true;

  return indicators;
}

/**
 * Main analyzer function
 */
async function analyzeRepo(repoPath, config = {}) {
  const maxDepth = parseInt(config.depth || 10);
  const userIgnore = (config.ignore || '').split(',').map(s => s.trim()).filter(Boolean);
  const ignorePatterns = [...DEFAULT_IGNORE, ...userIgnore];

  // Walk directory
  const allFiles = walkDir(repoPath, ignorePatterns, 0, maxDepth);

  // Filter to code files
  const codeFiles = allFiles.filter(f => ALL_CODE_EXTENSIONS.includes(path.extname(f).toLowerCase()));

  // Analyze each file
  const analyzedFiles = codeFiles
    .map(f => analyzeFile(f, repoPath))
    .filter(Boolean);

  // Build stats
  const totalLines = analyzedFiles.reduce((sum, f) => sum + f.lines, 0);
  const languageBreakdown = {};
  for (const file of analyzedFiles) {
    languageBreakdown[file.language] = (languageBreakdown[file.language] || 0) + 1;
  }

  // Project type detection
  const projectInfo = detectProjectType(repoPath, allFiles);

  // Directory tree
  const tree = buildDirectoryTree(codeFiles, repoPath);

  // Aggregate issues
  const allIssues = analyzedFiles.flatMap(f =>
    f.issues.map(i => ({ ...i, file: f.path }))
  );

  return {
    repoPath,
    projectInfo,
    totalFiles: analyzedFiles.length,
    totalAllFiles: allFiles.length,
    totalLines,
    languageBreakdown,
    files: analyzedFiles,
    tree,
    allIssues,
    analyzedAt: new Date().toISOString(),
  };
}

module.exports = { analyzeRepo, detectLanguage, SUPPORTED_EXTENSIONS };
