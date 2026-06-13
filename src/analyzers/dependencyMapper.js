/**
 * Dependency Mapper
 * Builds a directed graph of module/file dependencies across the codebase.
 */

const path = require('path');

/**
 * Resolve a relative import to a canonical path within the repo
 */
function resolveImport(importPath, fromFile, allFilePaths) {
  if (!importPath.startsWith('.')) {
    // External dependency
    return { type: 'external', name: importPath.split('/')[0] };
  }

  const fromDir = path.dirname(fromFile);
  const resolved = path.normalize(path.join(fromDir, importPath));

  // Try with various extensions
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '/index.js', '/index.ts'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (allFilePaths.has(candidate)) {
      return { type: 'internal', path: candidate };
    }
  }

  // Exact match
  if (allFilePaths.has(resolved)) {
    return { type: 'internal', path: resolved };
  }

  return { type: 'unresolved', name: importPath };
}

/**
 * Build adjacency list from analyzed files
 */
function buildAdjacencyList(analyzedFiles) {
  const allFilePaths = new Set(analyzedFiles.map(f => f.path));
  const adjacency = {};
  const externalDeps = new Set();
  const internalEdges = [];

  for (const file of analyzedFiles) {
    adjacency[file.path] = { imports: [], importedBy: [] };

    for (const imp of file.imports) {
      const resolved = resolveImport(imp, file.path, allFilePaths);
      if (resolved.type === 'internal') {
        internalEdges.push({ from: file.path, to: resolved.path });
        adjacency[file.path].imports.push(resolved.path);
      } else if (resolved.type === 'external') {
        externalDeps.add(resolved.name);
      }
    }
  }

  // Build importedBy (reverse edges)
  for (const edge of internalEdges) {
    if (adjacency[edge.to]) {
      adjacency[edge.to].importedBy.push(edge.from);
    }
  }

  return { adjacency, externalDeps: Array.from(externalDeps), internalEdges };
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(adjacency) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = adjacency[node]?.imports || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
      }
    }

    recursionStack.delete(node);
  }

  for (const node of Object.keys(adjacency)) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Calculate module centrality (how many modules depend on it)
 */
function calculateCentrality(adjacency) {
  const centrality = {};

  for (const [file, data] of Object.entries(adjacency)) {
    centrality[file] = {
      inDegree: data.importedBy.length,
      outDegree: data.imports.length,
      totalDegree: data.importedBy.length + data.imports.length,
    };
  }

  return centrality;
}

/**
 * Find entry points (files not imported by anything)
 */
function findEntryPoints(adjacency) {
  return Object.entries(adjacency)
    .filter(([, data]) => data.importedBy.length === 0 && data.imports.length > 0)
    .map(([path]) => path);
}

/**
 * Find leaf modules (files that don't import anything)
 */
function findLeafModules(adjacency) {
  return Object.entries(adjacency)
    .filter(([, data]) => data.imports.length === 0)
    .map(([path]) => path);
}

/**
 * Find highly coupled modules (imported by many)
 */
function findHighlyCoupled(centrality, threshold = 5) {
  return Object.entries(centrality)
    .filter(([, c]) => c.inDegree >= threshold)
    .sort((a, b) => b[1].inDegree - a[1].inDegree)
    .map(([path, c]) => ({ path, ...c }));
}

/**
 * Group files into logical clusters based on directory structure
 */
function buildModuleClusters(analyzedFiles) {
  const clusters = {};

  for (const file of analyzedFiles) {
    const parts = file.path.split(path.sep);
    const cluster = parts.length > 1 ? parts[0] : 'root';
    if (!clusters[cluster]) clusters[cluster] = [];
    clusters[cluster].push(file.path);
  }

  return clusters;
}

/**
 * Generate Mermaid.js diagram code
 */
function generateMermaidDiagram(adjacency, maxEdges = 50) {
  const lines = ['graph LR'];
  let edgeCount = 0;

  // Add nodes with sanitized IDs
  const nodeId = (p) => p.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, '');

  for (const [file, data] of Object.entries(adjacency)) {
    if (data.imports.length > 0) {
      const from = nodeId(file);
      for (const dep of data.imports.slice(0, 5)) {
        if (edgeCount >= maxEdges) break;
        const to = nodeId(dep);
        const fromLabel = path.basename(file);
        const toLabel = path.basename(dep);
        lines.push(`  ${from}["${fromLabel}"] --> ${to}["${toLabel}"]`);
        edgeCount++;
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate D3-compatible JSON for interactive visualization
 */
function generateD3Graph(adjacency, analyzedFiles) {
  const fileMap = new Map(analyzedFiles.map(f => [f.path, f]));
  const nodeIndex = new Map();
  const nodes = [];
  const links = [];

  let idx = 0;
  for (const file of Object.keys(adjacency)) {
    nodeIndex.set(file, idx++);
    const fileData = fileMap.get(file) || {};
    nodes.push({
      id: file,
      name: path.basename(file),
      language: fileData.language || 'unknown',
      lines: fileData.lines || 0,
      group: file.split(path.sep)[0] || 'root',
    });
  }

  for (const [file, data] of Object.entries(adjacency)) {
    for (const dep of data.imports) {
      if (nodeIndex.has(dep)) {
        links.push({
          source: nodeIndex.get(file),
          target: nodeIndex.get(dep),
          value: 1,
        });
      }
    }
  }

  return { nodes, links };
}

/**
 * Main dependency mapping function
 */
async function generateDependencyMap(analysis, config = {}) {
  const { adjacency, externalDeps, internalEdges } = buildAdjacencyList(analysis.files);
  const centrality = calculateCentrality(adjacency);
  const cycles = detectCircularDependencies(adjacency);
  const entryPoints = findEntryPoints(adjacency);
  const leafModules = findLeafModules(adjacency);
  const highlyCoupled = findHighlyCoupled(centrality, 3);
  const clusters = buildModuleClusters(analysis.files);
  const mermaidDiagram = generateMermaidDiagram(adjacency);
  const d3Graph = generateD3Graph(adjacency, analysis.files);

  return {
    nodes: Object.keys(adjacency).length,
    edges: internalEdges.length,
    adjacency,
    centrality,
    cycles,
    entryPoints,
    leafModules,
    highlyCoupled,
    externalDeps,
    clusters,
    mermaidDiagram,
    d3Graph,
    hasCycles: cycles.length > 0,
  };
}

module.exports = { generateDependencyMap, buildAdjacencyList, detectCircularDependencies };
