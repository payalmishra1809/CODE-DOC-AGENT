/**
 * Configuration Loader
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  output: './codedoc-output',
  format: 'markdown',
  model: 'claude-sonnet-4-6',
  depth: 10,
  ignore: '',
  refactor: true,
  deps: true,
  severity: 'low',
};

async function loadConfig(configPath, cliOptions = {}) {
  let fileConfig = {};

  const configFile = path.resolve(configPath || '.codedocrc.json');
  if (fs.existsSync(configFile)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch {
      // Ignore malformed config
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...Object.fromEntries(Object.entries(cliOptions).filter(([, v]) => v !== undefined)),
  };
}

module.exports = { loadConfig, DEFAULT_CONFIG };
