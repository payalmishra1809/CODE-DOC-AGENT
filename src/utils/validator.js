/**
 * Repository Validator
 * Resolves GitHub URLs or local paths to a usable local directory.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

/**
 * Check if a string is a GitHub URL
 */
function isGitHubUrl(str) {
  return /^https?:\/\/github\.com\//i.test(str) ||
         /^git@github\.com:/i.test(str) ||
         /^github\.com\//i.test(str);
}

/**
 * Normalize GitHub URL to HTTPS clone URL
 */
function normalizeGitHubUrl(url) {
  if (url.startsWith('git@github.com:')) {
    return 'https://github.com/' + url.slice(15).replace(/\.git$/, '') + '.git';
  }
  if (!url.startsWith('http')) {
    return 'https://' + url;
  }
  if (!url.endsWith('.git')) {
    return url + '.git';
  }
  return url;
}

/**
 * Clone a GitHub repository to a temp directory
 */
async function cloneRepo(url) {
  const normalized = normalizeGitHubUrl(url);
  const repoName = normalized.split('/').pop().replace('.git', '');
  const tmpDir = path.join(os.tmpdir(), `codedoc-${repoName}-${Date.now()}`);

  try {
    execSync(`git clone --depth=1 "${normalized}" "${tmpDir}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });
    return tmpDir;
  } catch (err) {
    const msg = err.stderr?.toString() || err.message;
    throw new Error(`Failed to clone repository: ${msg}`);
  }
}

/**
 * Validate and resolve a repo path or URL
 */
async function validateRepo(repo, config) {
  if (isGitHubUrl(repo)) {
    return await cloneRepo(repo);
  }

  // Local path
  const resolved = path.resolve(repo);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolved}`);
  }

  return resolved;
}

module.exports = { validateRepo, isGitHubUrl };
