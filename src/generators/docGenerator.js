/**
 * Documentation Generator
 * Uses Anthropic Claude API to generate comprehensive documentation
 * for the analyzed codebase.
 */

const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');

const client = new Anthropic();

/**
 * Generate overview documentation for the project
 */
async function generateProjectOverview(analysis, depMap, config) {
  const { projectInfo, totalFiles, totalLines, languageBreakdown, allIssues } = analysis;

  const langSummary = Object.entries(languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => `${lang}: ${count} files`)
    .join(', ');

  const entryPoints = depMap?.entryPoints?.slice(0, 5).join(', ') || 'none detected';
  const cycles = depMap?.hasCycles ? `⚠️ ${depMap.cycles.length} circular dependency cycle(s) detected` : '✅ No circular dependencies';

  const prompt = `You are a senior software architect writing documentation for a codebase.

PROJECT INFO:
- Name: ${projectInfo.packageName || 'Unknown'}
- Version: ${projectInfo.packageVersion || 'N/A'}
- Description: ${projectInfo.description || 'N/A'}
- Framework: ${projectInfo.framework || 'N/A'}
- TypeScript: ${projectInfo.typescript ? 'Yes' : 'No'}
- Docker: ${projectInfo.docker ? 'Yes' : 'No'}
- CI/CD: ${projectInfo.githubActions ? 'GitHub Actions' : projectInfo.travisCI ? 'Travis CI' : 'None detected'}
- Total Files: ${totalFiles}
- Total Lines: ${totalLines.toLocaleString()}
- Languages: ${langSummary}
- Entry Points: ${entryPoints}
- Dependency Status: ${cycles}
- Issues Found: ${allIssues.length}

Generate a comprehensive project overview in Markdown with:
1. ## Project Overview — 2–3 paragraphs describing purpose, architecture style, tech stack
2. ## Architecture Summary — describe the high-level architecture
3. ## Technology Stack — table of languages, frameworks, tools
4. ## Key Metrics — file count, LOC, language breakdown
5. ## Project Health — brief assessment of code quality based on issues

Be specific, professional, and concise. Use real data from above.`;

  const response = await client.messages.create({
    model: config.model || 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text;
}

/**
 * Generate documentation for a single file
 */
async function generateFileDoc(file, config) {
  const symbolSummary = [
    ...file.symbols.classes.map(c => `class: ${c}`),
    ...file.symbols.functions.slice(0, 10).map(f => `function: ${f}`),
    ...file.symbols.exports.slice(0, 5).map(e => `export: ${e}`),
  ].join(', ') || 'none detected';

  const prompt = `You are a senior developer writing concise documentation for a source file.

FILE: ${file.path}
LANGUAGE: ${file.language}
LINES: ${file.lines}
IMPORTS: ${file.imports.slice(0, 10).join(', ') || 'none'}
SYMBOLS: ${symbolSummary}

FILE CONTENT (first 150 lines):
\`\`\`${file.language}
${file.snippet}
\`\`\`

Write documentation in Markdown with:
1. **Purpose** — 1–2 sentences explaining what this file does
2. **Exports / Public API** — list key functions/classes with one-line descriptions
3. **Dependencies** — brief note on imports
4. **Usage Example** (if applicable) — short code example
5. **Notes** — any important implementation details

Keep it concise (under 400 words). Be precise.`;

  const response = await client.messages.create({
    model: config.model || 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text;
}

/**
 * Generate README.md for the project
 */
async function generateReadme(analysis, config) {
  const { projectInfo, totalFiles, totalLines } = analysis;

  const topFiles = analysis.files
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5)
    .map(f => `- \`${f.path}\` (${f.lines} lines, ${f.language})`)
    .join('\n');

  const prompt = `You are writing a professional README.md for an open-source GitHub repository.

PROJECT INFO:
- Name: ${projectInfo.packageName || 'Project'}
- Version: ${projectInfo.packageVersion || '1.0.0'}
- Description: ${projectInfo.description || 'A software project'}
- Framework: ${projectInfo.framework || 'N/A'}
- Scripts available: ${(projectInfo.scripts || []).join(', ') || 'none'}
- Total Files: ${totalFiles}, Total Lines: ${totalLines.toLocaleString()}
- Key files:
${topFiles}

Generate a complete README.md with:
1. Project title and badges (build passing, license MIT, version)
2. Brief description and key features (bullet list)
3. ## Installation — step by step
4. ## Usage — basic usage with code examples
5. ## Configuration — if applicable
6. ## Development — how to run in dev mode, run tests
7. ## Contributing — brief contributing guidelines
8. ## License — MIT

Make it professional, developer-friendly, and ready for GitHub.`;

  const response = await client.messages.create({
    model: config.model || 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text;
}

/**
 * Generate API documentation (for JS/TS projects)
 */
async function generateApiDocs(analysis, config) {
  const jstsFiles = analysis.files.filter(f =>
    ['javascript', 'typescript'].includes(f.language) &&
    f.symbols.exports.length > 0
  ).slice(0, 20);

  if (jstsFiles.length === 0) return null;

  const exportSummary = jstsFiles.map(f =>
    `### ${f.path}\nExports: ${f.symbols.exports.join(', ')}\nFunctions: ${f.symbols.functions.slice(0, 5).join(', ')}`
  ).join('\n\n');

  const prompt = `Generate API Reference documentation in Markdown for these modules:

${exportSummary}

Format as:
# API Reference
## Modules
For each module: name, brief description, and table of exported functions/classes with parameters and return types (infer from names).

Keep it concise but complete.`;

  const response = await client.messages.create({
    model: config.model || 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text;
}

/**
 * Main documentation generator
 */
async function generateDocs(analysis, depMap, config = {}) {
  const docFiles = [];
  const errors = [];

  // Project overview
  try {
    const overview = await generateProjectOverview(analysis, depMap, config);
    docFiles.push({ name: 'PROJECT_OVERVIEW.md', content: overview });
  } catch (e) {
    errors.push(`Overview: ${e.message}`);
  }

  // README
  try {
    const readme = await generateReadme(analysis, config);
    docFiles.push({ name: 'README_GENERATED.md', content: readme });
  } catch (e) {
    errors.push(`README: ${e.message}`);
  }

  // Per-file docs (prioritize larger, more complex files)
  const filesToDoc = analysis.files
    .filter(f => !['json', 'yaml', 'markdown'].includes(f.language))
    .filter(f => f.lines > 20)
    .sort((a, b) => (b.symbols.functions.length + b.symbols.classes.length) - (a.symbols.functions.length + a.symbols.classes.length))
    .slice(0, 20); // Document top 20 files

  const fileDocs = [];
  for (const file of filesToDoc) {
    try {
      const doc = await generateFileDoc(file, config);
      fileDocs.push({ file: file.path, content: doc });
    } catch (e) {
      errors.push(`File doc ${file.path}: ${e.message}`);
    }
  }

  // Combine all file docs into one
  if (fileDocs.length > 0) {
    const combinedFileDocs = fileDocs
      .map(d => `# \`${d.file}\`\n\n${d.content}`)
      .join('\n\n---\n\n');
    docFiles.push({ name: 'FILE_DOCUMENTATION.md', content: combinedFileDocs });
  }

  // API docs for JS/TS
  if (['javascript', 'typescript'].some(l => analysis.languageBreakdown[l] > 0)) {
    try {
      const apiDocs = await generateApiDocs(analysis, config);
      if (apiDocs) docFiles.push({ name: 'API_REFERENCE.md', content: apiDocs });
    } catch (e) {
      errors.push(`API docs: ${e.message}`);
    }
  }

  return { files: docFiles, errors, generatedAt: new Date().toISOString() };
}

module.exports = { generateDocs, generateProjectOverview, generateFileDoc };
