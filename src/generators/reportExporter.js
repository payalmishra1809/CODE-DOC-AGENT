/**
 * Report Exporter
 * Writes all generated documentation, refactoring reports,
 * and dependency maps to the output directory.
 */

const fs = require('fs');
const path = require('path');

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Write a file safely
 */
function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Generate the dependency map HTML visualization
 */
function generateDepMapHtml(depMap) {
  if (!depMap) return null;

  const graphData = JSON.stringify(depMap.d3Graph);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dependency Map</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; }
    #header { padding: 20px 24px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 12px; }
    #header h1 { font-size: 18px; font-weight: 700; color: #38bdf8; }
    #stats { display: flex; gap: 20px; margin-left: auto; font-size: 13px; color: #94a3b8; }
    #stats span b { color: #e2e8f0; }
    #canvas { width: 100vw; height: calc(100vh - 65px); }
    .node circle { stroke-width: 2; cursor: pointer; transition: r 0.2s; }
    .node text { font-size: 11px; fill: #cbd5e1; pointer-events: none; }
    .link { stroke: #334155; stroke-opacity: 0.6; }
    .tooltip { position: fixed; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; font-size: 12px; pointer-events: none; display: none; z-index: 100; }
    #legend { position: fixed; bottom: 20px; left: 20px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; font-size: 12px; }
    #legend h3 { margin-bottom: 8px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
  </style>
</head>
<body>
  <div id="header">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="5" r="2.5" fill="#38bdf8"/>
      <circle cx="5" cy="17" r="2.5" fill="#818cf8"/>
      <circle cx="19" cy="17" r="2.5" fill="#34d399"/>
      <line x1="12" y1="7.5" x2="6" y2="15" stroke="#475569" stroke-width="1.5"/>
      <line x1="12" y1="7.5" x2="18" y2="15" stroke="#475569" stroke-width="1.5"/>
    </svg>
    <h1>Dependency Map</h1>
    <div id="stats">
      <span><b>${depMap.nodes}</b> modules</span>
      <span><b>${depMap.edges}</b> connections</span>
      ${depMap.hasCycles ? `<span style="color:#f87171"><b>${depMap.cycles.length}</b> cycles ⚠️</span>` : '<span style="color:#34d399">✅ No cycles</span>'}
    </div>
  </div>
  <svg id="canvas"></svg>
  <div class="tooltip" id="tooltip"></div>
  <div id="legend">
    <h3>Languages</h3>
    <div class="legend-item"><div class="legend-dot" style="background:#f7df1e"></div>JavaScript</div>
    <div class="legend-item"><div class="legend-dot" style="background:#3178c6"></div>TypeScript</div>
    <div class="legend-item"><div class="legend-dot" style="background:#3572a5"></div>Python</div>
    <div class="legend-item"><div class="legend-dot" style="background:#b07219"></div>Java</div>
    <div class="legend-item"><div class="legend-dot" style="background:#94a3b8"></div>Other</div>
  </div>
  <script>
    const graphData = ${graphData};
    const colors = {
      javascript: '#f7df1e', typescript: '#3178c6', python: '#3572a5',
      java: '#b07219', go: '#00add8', rust: '#dea584',
      ruby: '#cc342d', php: '#777bb4', unknown: '#94a3b8'
    };

    const svg = d3.select('#canvas');
    const width = window.innerWidth;
    const height = window.innerHeight - 65;
    svg.attr('viewBox', [0, 0, width, height]);

    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.links).id(d => d.id || graphData.nodes.indexOf(d)).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(20));

    const link = svg.append('g')
      .selectAll('line').data(graphData.links).join('line')
      .attr('class', 'link')
      .attr('stroke-width', 1);

    const node = svg.append('g')
      .selectAll('g').data(graphData.nodes).join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
        .on('drag', (e, d) => { d.fx=e.x; d.fy=e.y; })
        .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx=null; d.fy=null; }));

    node.append('circle')
      .attr('r', d => 5 + Math.min(d.lines / 100, 10))
      .attr('fill', d => colors[d.language] || colors.unknown)
      .attr('stroke', '#1e293b')
      .on('mouseover', (e, d) => {
        document.getElementById('tooltip').style.display = 'block';
        document.getElementById('tooltip').innerHTML =
          '<b>' + d.name + '</b><br>Language: ' + d.language + '<br>Lines: ' + d.lines + '<br>Path: ' + d.id;
      })
      .on('mousemove', (e) => {
        const t = document.getElementById('tooltip');
        t.style.left = (e.clientX + 12) + 'px';
        t.style.top = (e.clientY - 10) + 'px';
      })
      .on('mouseout', () => { document.getElementById('tooltip').style.display = 'none'; });

    node.append('text').attr('x', 12).attr('dy', 4)
      .text(d => d.name.length > 20 ? d.name.slice(0, 20) + '…' : d.name);

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
    });

    svg.call(d3.zoom().scaleExtent([0.1, 4]).on('zoom', e => {
      svg.selectAll('g').attr('transform', e.transform);
    }));
  </script>
</body>
</html>`;
}

/**
 * Generate the main report index.html
 */
function generateIndexHtml(analysis, docs, refactorReport, depMap) {
  const { projectInfo, totalFiles, totalLines, languageBreakdown, allIssues } = analysis;

  const langRows = Object.entries(languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `<tr><td>${lang}</td><td>${count}</td><td>${Math.round(count/totalFiles*100)}%</td></tr>`)
    .join('');

  const topSuggestions = (refactorReport?.suggestions || []).slice(0, 10);
  const severityColor = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };

  const suggestionRows = topSuggestions.map(s => `
    <div class="suggestion-card severity-${s.severity}">
      <div class="sug-header">
        <span class="badge badge-${s.severity}">${s.severity.toUpperCase()}</span>
        <span class="sug-title">${s.title}</span>
        <code class="sug-file">${s.file}</code>
      </div>
      <p>${s.description}</p>
      <div class="sug-action">💡 ${s.suggestion}</div>
    </div>`).join('');

  const health = refactorReport?.summary?.healthGrade || 'N/A';
  const healthColor = { A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444' }[health] || '#94a3b8';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${projectInfo.packageName || 'CodeDoc'} — Documentation Report</title>
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    header { background: var(--card); border-bottom: 1px solid var(--border); padding: 24px 0; }
    header h1 { font-size: 24px; font-weight: 800; color: var(--accent); }
    header p { color: var(--muted); margin-top: 4px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 32px 0; }
    .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; }
    .stat-card .num { font-size: 32px; font-weight: 800; color: var(--accent); }
    .stat-card .label { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .section { margin: 40px 0; }
    .section h2 { font-size: 18px; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 14px; }
    th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; background: var(--card); }
    .suggestion-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 12px; border-left: 4px solid var(--border); }
    .suggestion-card.severity-critical { border-left-color: #ef4444; }
    .suggestion-card.severity-high { border-left-color: #f97316; }
    .suggestion-card.severity-medium { border-left-color: #f59e0b; }
    .suggestion-card.severity-low { border-left-color: #22c55e; }
    .sug-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
    .sug-title { font-weight: 600; font-size: 15px; }
    .sug-file { font-size: 11px; color: var(--muted); background: var(--bg); padding: 2px 8px; border-radius: 4px; margin-left: auto; }
    .badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; }
    .badge-critical { background: #7f1d1d; color: #fca5a5; }
    .badge-high { background: #7c2d12; color: #fdba74; }
    .badge-medium { background: #78350f; color: #fcd34d; }
    .badge-low { background: #14532d; color: #86efac; }
    .sug-action { margin-top: 8px; font-size: 13px; color: #93c5fd; background: rgba(59,130,246,0.1); padding: 8px 12px; border-radius: 6px; }
    .health-grade { font-size: 72px; font-weight: 900; color: ${healthColor}; text-align: center; }
    .health-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; text-align: center; }
    .nav-links { display: flex; gap: 12px; margin: 24px 0; flex-wrap: wrap; }
    .nav-link { background: var(--card); border: 1px solid var(--accent); color: var(--accent); text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; transition: background 0.2s; }
    .nav-link:hover { background: var(--accent); color: var(--bg); }
    footer { margin: 60px 0 30px; text-align: center; color: var(--muted); font-size: 13px; }
    @media(max-width:600px) { .stats-grid { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>🤖 ${projectInfo.packageName || 'Project'} — CodeDoc Report</h1>
      <p>Generated on ${new Date().toLocaleString()} · v${projectInfo.packageVersion || '1.0.0'} · ${projectInfo.framework || 'Unknown framework'}</p>
    </div>
  </header>

  <div class="container">
    <div class="nav-links">
      ${depMap ? '<a class="nav-link" href="dependency-map.html">🗺️ Dependency Map</a>' : ''}
      <a class="nav-link" href="docs/PROJECT_OVERVIEW.md">📋 Project Overview</a>
      <a class="nav-link" href="docs/README_GENERATED.md">📖 README</a>
      <a class="nav-link" href="docs/FILE_DOCUMENTATION.md">📄 File Docs</a>
      ${docs?.files?.find(f => f.name === 'API_REFERENCE.md') ? '<a class="nav-link" href="docs/API_REFERENCE.md">⚡ API Reference</a>' : ''}
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="num">${totalFiles}</div><div class="label">Files Analyzed</div></div>
      <div class="stat-card"><div class="num">${totalLines.toLocaleString()}</div><div class="label">Lines of Code</div></div>
      <div class="stat-card"><div class="num">${refactorReport?.summary?.totalSuggestions || 0}</div><div class="label">Refactor Suggestions</div></div>
      <div class="stat-card"><div class="num">${depMap?.edges || 0}</div><div class="label">Dependency Links</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:40px">
      <div class="section">
        <h2>📊 Language Breakdown</h2>
        <table>
          <thead><tr><th>Language</th><th>Files</th><th>%</th></tr></thead>
          <tbody>${langRows}</tbody>
        </table>
      </div>
      <div class="health-card">
        <div style="color:var(--muted);font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Code Health Grade</div>
        <div class="health-grade">${health}</div>
        <div style="margin-top:12px;font-size:14px;color:var(--muted)">
          ${refactorReport?.summary?.bySeverity?.critical || 0} critical · 
          ${refactorReport?.summary?.bySeverity?.high || 0} high · 
          ${refactorReport?.summary?.bySeverity?.medium || 0} medium · 
          ${refactorReport?.summary?.bySeverity?.low || 0} low
        </div>
      </div>
    </div>

    <div class="section">
      <h2>🔧 Top Refactoring Suggestions</h2>
      ${suggestionRows || '<p style="color:var(--muted)">No significant issues found. Great job! 🎉</p>'}
    </div>

    <footer>Generated by <strong>CodeDoc Agent</strong> v1.0.0 · Powered by Claude AI</footer>
  </div>
</body>
</html>`;
}

/**
 * Generate markdown dependency report
 */
function generateDepMapMarkdown(depMap) {
  if (!depMap) return '';

  const lines = [
    '# Dependency Map Report\n',
    `**Modules:** ${depMap.nodes}  |  **Connections:** ${depMap.edges}  |  **Cycles:** ${depMap.cycles.length}\n`,
    '## Circular Dependencies',
    depMap.hasCycles
      ? depMap.cycles.slice(0, 10).map((c, i) => `${i+1}. ${c.join(' → ')}`).join('\n')
      : '✅ No circular dependencies detected.\n',
    '\n## Most Imported Modules (Highly Coupled)',
    ...depMap.highlyCoupled.slice(0, 10).map(m => `- \`${m.path}\` — imported by **${m.inDegree}** modules`),
    '\n## Entry Points',
    ...(depMap.entryPoints.slice(0, 10).map(e => `- \`${e}\``)),
    '\n## External Dependencies',
    depMap.externalDeps.sort().map(d => `- ${d}`).join('\n'),
    '\n## Dependency Diagram (Mermaid)\n',
    '```mermaid',
    depMap.mermaidDiagram,
    '```',
  ];

  return lines.join('\n');
}

/**
 * Generate refactoring report markdown
 */
function generateRefactorMarkdown(refactorReport) {
  if (!refactorReport) return '';

  const { suggestions, summary } = refactorReport;
  const lines = [
    '# Refactoring Report\n',
    `**Code Health Grade: ${summary.healthGrade}**  |  Priority Score: ${summary.priorityScore}\n`,
    '## Summary',
    `| Severity | Count |`,
    `|----------|-------|`,
    `| 🔴 Critical | ${summary.bySeverity.critical} |`,
    `| 🟠 High | ${summary.bySeverity.high} |`,
    `| 🟡 Medium | ${summary.bySeverity.medium} |`,
    `| 🟢 Low | ${summary.bySeverity.low} |`,
    `| **Total** | **${summary.totalSuggestions}** |`,
    '\n## Suggestions\n',
  ];

  for (const s of suggestions) {
    lines.push(`### [${s.severity.toUpperCase()}] ${s.title}`);
    lines.push(`**File:** \`${s.file}\`  |  **Type:** ${s.type}`);
    lines.push(`\n${s.description}\n`);
    lines.push(`**Suggestion:** ${s.suggestion}\n`);
    if (s.before) {
      lines.push('**Before:**');
      lines.push('```');
      lines.push(s.before);
      lines.push('```');
    }
    if (s.after) {
      lines.push('**After:**');
      lines.push('```');
      lines.push(s.after);
      lines.push('```');
    }
    lines.push('---\n');
  }

  return lines.join('\n');
}

/**
 * Main export function
 */
async function exportReport({ analysis, depMap, docs, refactorReport, config }) {
  const outputDir = path.resolve(config.output || './codedoc-output');
  const docsDir = path.join(outputDir, 'docs');

  ensureDir(outputDir);
  ensureDir(docsDir);

  const written = [];

  // Write doc files
  if (docs) {
    for (const docFile of docs.files) {
      const filePath = path.join(docsDir, docFile.name);
      writeFile(filePath, docFile.content);
      written.push(filePath);
    }
  }

  // Write dependency map
  if (depMap) {
    const depMd = generateDepMapMarkdown(depMap);
    writeFile(path.join(docsDir, 'DEPENDENCY_MAP.md'), depMd);
    written.push(path.join(docsDir, 'DEPENDENCY_MAP.md'));

    const depHtml = generateDepMapHtml(depMap);
    writeFile(path.join(outputDir, 'dependency-map.html'), depHtml);
    written.push(path.join(outputDir, 'dependency-map.html'));

    // Write D3 graph JSON
    writeFile(path.join(outputDir, 'dep-graph.json'), JSON.stringify(depMap.d3Graph, null, 2));
  }

  // Write refactoring report
  if (refactorReport) {
    const refactorMd = generateRefactorMarkdown(refactorReport);
    writeFile(path.join(docsDir, 'REFACTORING_REPORT.md'), refactorMd);
    written.push(path.join(docsDir, 'REFACTORING_REPORT.md'));

    writeFile(path.join(outputDir, 'refactoring-report.json'), JSON.stringify(refactorReport, null, 2));
  }

  // Write analysis JSON
  const analysisExport = {
    ...analysis,
    files: analysis.files.map(f => ({
      path: f.path,
      language: f.language,
      lines: f.lines,
      symbols: f.symbols,
      imports: f.imports,
      issues: f.issues,
    })),
  };
  writeFile(path.join(outputDir, 'analysis.json'), JSON.stringify(analysisExport, null, 2));

  // Write main HTML report
  const indexHtml = generateIndexHtml(analysis, docs, refactorReport, depMap);
  writeFile(path.join(outputDir, 'index.html'), indexHtml);
  written.push(path.join(outputDir, 'index.html'));

  return { outputDir, written };
}

module.exports = { exportReport };
