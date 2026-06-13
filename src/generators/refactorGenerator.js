/**
 * Refactoring Suggestion Generator
 * Uses Claude AI to analyze code and provide actionable refactoring suggestions.
 */

const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const client = new Anthropic();

const SEVERITY_LEVELS = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Get AI refactoring suggestions for a single file
 */
async function analyzeFileForRefactoring(file, config) {
  const content = file.fullContent || file.snippet;

  // Skip trivial files
  if (file.lines < 30 || ['json', 'yaml', 'markdown'].includes(file.language)) {
    return [];
  }

  const prompt = `You are a senior software engineer reviewing code for refactoring opportunities.

FILE: ${file.path}
LANGUAGE: ${file.language}
LINES: ${file.lines}

\`\`\`${file.language}
${content.slice(0, 8000)}
\`\`\`

Analyze this code and return a JSON array of refactoring suggestions. Each suggestion must be:
{
  "type": "string (e.g. extract_function, reduce_complexity, naming, dead_code, etc.)",
  "severity": "low | medium | high | critical",
  "title": "short title",
  "description": "what the problem is",
  "suggestion": "specific actionable fix",
  "lineHint": "approximate line number or range if applicable",
  "before": "brief code snippet showing the problem (1–5 lines)",
  "after": "brief improved version (1–5 lines)"
}

Focus on:
- Functions/methods that are too long (>50 lines) → extract
- Deep nesting (>3 levels) → early returns / guard clauses
- Magic numbers/strings → named constants
- Duplicate code patterns → extract to util
- Dead/unreachable code → remove
- Poor naming → rename
- Missing error handling
- Performance anti-patterns

Return ONLY valid JSON array, no other text. If no issues, return [].`;

  try {
    const response = await client.messages.create({
      model: config.model || 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const suggestions = JSON.parse(jsonMatch[0]);
    return suggestions.map(s => ({ ...s, file: file.path }));
  } catch {
    return [];
  }
}

/**
 * Generate architectural refactoring suggestions based on overall analysis
 */
async function analyzeArchitecture(analysis, depMap, config) {
  const issues = [];

  // Check for circular dependencies
  if (depMap?.hasCycles) {
    for (const cycle of depMap.cycles.slice(0, 5)) {
      issues.push({
        type: 'circular_dependency',
        severity: 'high',
        title: 'Circular Dependency Detected',
        description: `Circular import chain: ${cycle.map(c => path.basename(c)).join(' → ')}`,
        suggestion: 'Break the cycle by introducing an abstraction layer, event system, or dependency injection.',
        file: cycle[0],
        lineHint: 'N/A',
        before: `// ${cycle.map(c => path.basename(c)).join(' → ')} → (circular)`,
        after: '// Introduce shared interface/types module to break the cycle',
      });
    }
  }

  // Check for highly coupled modules
  if (depMap?.highlyCoupled?.length > 0) {
    for (const mod of depMap.highlyCoupled.slice(0, 3)) {
      issues.push({
        type: 'high_coupling',
        severity: 'medium',
        title: `Highly Coupled Module (${mod.inDegree} dependents)`,
        description: `${mod.path} is imported by ${mod.inDegree} other modules, creating a high-coupling hub.`,
        suggestion: 'Consider splitting into smaller, more focused modules or introducing an interface layer.',
        file: mod.path,
        lineHint: 'N/A',
        before: `// ${mod.inDegree} files depend on ${path.basename(mod.path)}`,
        after: '// Split into feature-specific sub-modules',
      });
    }
  }

  // Check for very large files
  const largeFiles = analysis.files
    .filter(f => f.lines > 400 && !['json', 'yaml', 'markdown'].includes(f.language))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);

  for (const file of largeFiles) {
    issues.push({
      type: 'large_file',
      severity: file.lines > 800 ? 'high' : 'medium',
      title: `Large File (${file.lines} lines)`,
      description: `${file.path} has ${file.lines} lines, making it hard to maintain.`,
      suggestion: 'Split into multiple focused modules. Single Responsibility Principle: each file should have one reason to change.',
      file: file.path,
      lineHint: 'Entire file',
      before: `// ${file.lines}-line file with ${file.symbols.functions.length} functions`,
      after: '// Split into: feature-specific modules under a directory',
    });
  }

  // No tests detected
  const hasTests = analysis.files.some(f =>
    f.path.includes('test') || f.path.includes('spec') || f.path.includes('__tests__')
  );
  if (!hasTests && analysis.totalFiles > 10) {
    issues.push({
      type: 'no_tests',
      severity: 'high',
      title: 'No Test Files Detected',
      description: 'No test files found in the project. This is a significant risk for maintainability.',
      suggestion: 'Add unit tests using Jest (JS/TS), pytest (Python), or the appropriate framework for your stack.',
      file: 'project-wide',
      lineHint: 'N/A',
      before: '// No *.test.*, *.spec.*, __tests__/ files found',
      after: '// Add: src/__tests__/example.test.js with Jest',
    });
  }

  // Check for missing error handling
  const filesWithoutErrorHandling = analysis.files
    .filter(f => ['javascript', 'typescript'].includes(f.language))
    .filter(f => f.fullContent && f.fullContent.includes('async') && !f.fullContent.includes('try'))
    .slice(0, 3);

  for (const file of filesWithoutErrorHandling) {
    issues.push({
      type: 'missing_error_handling',
      severity: 'medium',
      title: 'Async Functions Without Error Handling',
      description: `${file.path} has async operations but no try/catch blocks.`,
      suggestion: 'Wrap async operations in try/catch or use a result-pattern for consistent error handling.',
      file: file.path,
      lineHint: 'async functions',
      before: 'const data = await fetchData();',
      after: 'try { const data = await fetchData(); } catch (err) { logger.error(err); throw err; }',
    });
  }

  return issues;
}

/**
 * Generate summary statistics for the refactoring report
 */
function generateSummary(suggestions) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType = {};

  for (const s of suggestions) {
    const sev = s.severity || 'low';
    if (bySeverity[sev] !== undefined) bySeverity[sev]++;
    byType[s.type] = (byType[s.type] || 0) + 1;
  }

  const priorityScore = (
    bySeverity.critical * 10 +
    bySeverity.high * 5 +
    bySeverity.medium * 2 +
    bySeverity.low * 1
  );

  let healthGrade = 'A';
  if (priorityScore > 50) healthGrade = 'B';
  if (priorityScore > 100) healthGrade = 'C';
  if (priorityScore > 200) healthGrade = 'D';
  if (priorityScore > 400) healthGrade = 'F';

  return { bySeverity, byType, priorityScore, healthGrade, totalSuggestions: suggestions.length };
}

/**
 * Main refactoring analysis function
 */
async function generateRefactorSuggestions(analysis, config = {}) {
  const minSeverity = config.severity || 'low';
  const minSeverityLevel = SEVERITY_LEVELS[minSeverity] || 1;

  const allSuggestions = [];

  // Architectural analysis first (no AI calls needed)
  const archSuggestions = await analyzeArchitecture(analysis, null, config);
  allSuggestions.push(...archSuggestions);

  // Static analysis issues from repo analyzer
  for (const issue of analysis.allIssues) {
    allSuggestions.push({
      type: issue.type,
      severity: issue.severity,
      title: issue.message,
      description: `Detected in static analysis`,
      suggestion: getStaticSuggestion(issue.type),
      file: issue.file,
      lineHint: 'Various',
      before: '',
      after: '',
    });
  }

  // AI-powered per-file analysis (top 10 most complex files)
  const filesToAnalyze = analysis.files
    .filter(f => !['json', 'yaml', 'markdown'].includes(f.language))
    .filter(f => f.lines > 50)
    .sort((a, b) =>
      (b.issues.length + b.symbols.functions.length) -
      (a.issues.length + a.symbols.functions.length)
    )
    .slice(0, 10);

  for (const file of filesToAnalyze) {
    try {
      const fileSuggestions = await analyzeFileForRefactoring(file, config);
      allSuggestions.push(...fileSuggestions);
    } catch {
      // Continue on error
    }
  }

  // Filter by severity
  const filtered = allSuggestions.filter(s =>
    (SEVERITY_LEVELS[s.severity] || 1) >= minSeverityLevel
  );

  // Sort by severity
  const sorted = filtered.sort((a, b) =>
    (SEVERITY_LEVELS[b.severity] || 0) - (SEVERITY_LEVELS[a.severity] || 0)
  );

  const summary = generateSummary(sorted);

  return {
    suggestions: sorted,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

function getStaticSuggestion(type) {
  const suggestions = {
    long_file: 'Split into smaller, focused modules. Aim for <300 lines per file.',
    todos: 'Address or track TODO/FIXME comments in your issue tracker.',
    debug_statements: 'Remove console.log statements; use a proper logging library.',
    long_function: 'Extract logic into smaller helper functions (aim for <50 lines).',
    deep_nesting: 'Use early returns/guard clauses to reduce nesting depth.',
  };
  return suggestions[type] || 'Review and address this code quality issue.';
}

module.exports = { generateRefactorSuggestions };
