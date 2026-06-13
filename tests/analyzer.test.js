/**
 * Tests for Repository Analyzer
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { analyzeRepo, detectLanguage } = require('../src/analyzers/repoAnalyzer');
const { buildAdjacencyList, detectCircularDependencies } = require('../src/analyzers/dependencyMapper');

// ── detectLanguage ────────────────────────────────────────────────────────────

describe('detectLanguage', () => {
  test('detects JavaScript', () => expect(detectLanguage('app.js')).toBe('javascript'));
  test('detects TypeScript', () => expect(detectLanguage('component.tsx')).toBe('typescript'));
  test('detects Python', () => expect(detectLanguage('script.py')).toBe('python'));
  test('detects Go', () => expect(detectLanguage('main.go')).toBe('go'));
  test('returns unknown for unknown extension', () => expect(detectLanguage('file.xyz')).toBe('unknown'));
});

// ── analyzeRepo ───────────────────────────────────────────────────────────────

describe('analyzeRepo', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codedoc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('analyzes a simple JS project', async () => {
    fs.writeFileSync(path.join(tmpDir, 'index.js'), `
const express = require('express');
const router = require('./router');

function startServer(port) {
  const app = express();
  app.use(router);
  app.listen(port);
}

module.exports = { startServer };
    `.trim());

    fs.writeFileSync(path.join(tmpDir, 'router.js'), `
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ ok: true }));

module.exports = router;
    `.trim());

    const analysis = await analyzeRepo(tmpDir, {});

    expect(analysis.totalFiles).toBe(2);
    expect(analysis.totalLines).toBeGreaterThan(0);
    expect(analysis.languageBreakdown.javascript).toBe(2);
    expect(analysis.files.some(f => f.path.includes('index.js'))).toBe(true);
  });

  test('respects ignore patterns', async () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'));
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'lib.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(tmpDir, 'app.js'), 'const x = 1;');

    const analysis = await analyzeRepo(tmpDir, {});
    expect(analysis.totalFiles).toBe(1);
  });

  test('extracts function symbols', async () => {
    fs.writeFileSync(path.join(tmpDir, 'utils.js'), `
function add(a, b) { return a + b; }
function subtract(a, b) { return a - b; }
class Calculator { }
module.exports = { add, subtract, Calculator };
    `.trim());

    const analysis = await analyzeRepo(tmpDir, {});
    const file = analysis.files[0];
    expect(file.symbols.functions).toContain('add');
    expect(file.symbols.functions).toContain('subtract');
    expect(file.symbols.classes).toContain('Calculator');
  });
});

// ── dependencyMapper ──────────────────────────────────────────────────────────

describe('buildAdjacencyList', () => {
  test('resolves internal imports', () => {
    const files = [
      { path: 'src/index.js', imports: ['./utils', './router'], language: 'javascript', lines: 10, symbols: {} },
      { path: 'src/utils.js', imports: [], language: 'javascript', lines: 5, symbols: {} },
      { path: 'src/router.js', imports: ['./utils'], language: 'javascript', lines: 8, symbols: {} },
    ];

    const { adjacency, internalEdges } = buildAdjacencyList(files);

    expect(internalEdges.length).toBeGreaterThan(0);
    expect(Object.keys(adjacency)).toHaveLength(3);
  });
});

describe('detectCircularDependencies', () => {
  test('detects a simple cycle', () => {
    const adjacency = {
      'a.js': { imports: ['b.js'], importedBy: ['c.js'] },
      'b.js': { imports: ['c.js'], importedBy: ['a.js'] },
      'c.js': { imports: ['a.js'], importedBy: ['b.js'] },
    };

    const cycles = detectCircularDependencies(adjacency);
    expect(cycles.length).toBeGreaterThan(0);
  });

  test('returns empty for acyclic graph', () => {
    const adjacency = {
      'a.js': { imports: ['b.js'], importedBy: [] },
      'b.js': { imports: ['c.js'], importedBy: ['a.js'] },
      'c.js': { imports: [], importedBy: ['b.js'] },
    };

    const cycles = detectCircularDependencies(adjacency);
    expect(cycles.length).toBe(0);
  });
});
