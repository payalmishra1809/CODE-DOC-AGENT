#!/usr/bin/env node

/**
 * CodeDoc Agent - Automated Codebase Documentation & Refactoring Agent
 * CLI Entry Point
 */

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const { analyzeRepo } = require('../analyzers/repoAnalyzer');
const { generateDocs } = require('../generators/docGenerator');
const { generateRefactorSuggestions } = require('../generators/refactorGenerator');
const { generateDependencyMap } = require('../analyzers/dependencyMapper');
const { exportReport } = require('../generators/reportExporter');
const { loadConfig } = require('../utils/config');
const { validateRepo } = require('../utils/validator');
const { printBanner, printSummary } = require('../utils/display');

const VERSION = '1.0.0';

program
  .name('codedoc')
  .description('🤖 Automated Codebase Documentation & Refactoring Agent')
  .version(VERSION);

// Main analyze + document command
program
  .command('analyze <repo>')
  .description('Analyze a local repo or GitHub URL and generate full docs + refactor suggestions')
  .option('-o, --output <dir>', 'Output directory for generated docs', './codedoc-output')
  .option('-f, --format <format>', 'Output format: markdown | html | json', 'markdown')
  .option('--no-refactor', 'Skip refactoring suggestions')
  .option('--no-deps', 'Skip dependency map generation')
  .option('--depth <n>', 'Max directory depth to analyze', '10')
  .option('--ignore <patterns>', 'Comma-separated glob patterns to ignore', 'node_modules,dist,.git')
  .option('--model <model>', 'Anthropic model to use', 'claude-sonnet-4-6')
  .option('-c, --config <file>', 'Path to config file', '.codedocrc.json')
  .action(async (repo, options) => {
    printBanner(VERSION);

    const config = await loadConfig(options.config, options);
    const spinner = ora();

    try {
      // Step 1: Validate & resolve repo
      spinner.start(chalk.cyan('Resolving repository...'));
      const repoPath = await validateRepo(repo, config);
      spinner.succeed(chalk.green(`Repository resolved: ${chalk.bold(repoPath)}`));

      // Step 2: Analyze codebase
      spinner.start(chalk.cyan('Analyzing codebase structure...'));
      const analysis = await analyzeRepo(repoPath, config);
      spinner.succeed(chalk.green(`Analysis complete: ${analysis.totalFiles} files, ${analysis.totalLines} lines`));

      // Step 3: Dependency mapping
      let depMap = null;
      if (config.deps !== false) {
        spinner.start(chalk.cyan('Mapping dependencies...'));
        depMap = await generateDependencyMap(analysis, config);
        spinner.succeed(chalk.green(`Dependency map: ${depMap.nodes} modules, ${depMap.edges} connections`));
      }

      // Step 4: Generate documentation
      spinner.start(chalk.cyan('Generating documentation with AI...'));
      const docs = await generateDocs(analysis, depMap, config);
      spinner.succeed(chalk.green(`Documentation generated: ${docs.files.length} doc files`));

      // Step 5: Refactoring suggestions
      let refactorReport = null;
      if (config.refactor !== false) {
        spinner.start(chalk.cyan('Generating refactoring suggestions...'));
        refactorReport = await generateRefactorSuggestions(analysis, config);
        spinner.succeed(chalk.green(`Refactoring: ${refactorReport.suggestions.length} suggestions found`));
      }

      // Step 6: Export everything
      spinner.start(chalk.cyan(`Exporting to ${config.output}...`));
      const exportResult = await exportReport({
        analysis,
        depMap,
        docs,
        refactorReport,
        config,
      });
      spinner.succeed(chalk.green(`Exported successfully to ${chalk.bold(exportResult.outputDir)}`));

      printSummary(analysis, docs, refactorReport, exportResult);

    } catch (err) {
      spinner.fail(chalk.red(`Error: ${err.message}`));
      if (process.env.DEBUG) console.error(err);
      process.exit(1);
    }
  });

// Docs-only command
program
  .command('docs <repo>')
  .description('Generate documentation only (no refactoring analysis)')
  .option('-o, --output <dir>', 'Output directory', './codedoc-output')
  .option('-f, --format <format>', 'Output format', 'markdown')
  .option('--model <model>', 'Anthropic model', 'claude-sonnet-4-6')
  .action(async (repo, options) => {
    printBanner(VERSION);
    const config = { ...options, refactor: false };
    const spinner = ora();

    try {
      spinner.start(chalk.cyan('Resolving repository...'));
      const repoPath = await validateRepo(repo, config);
      spinner.succeed(chalk.green(`Repository: ${repoPath}`));

      spinner.start(chalk.cyan('Analyzing codebase...'));
      const analysis = await analyzeRepo(repoPath, config);
      spinner.succeed(chalk.green(`Analyzed ${analysis.totalFiles} files`));

      spinner.start(chalk.cyan('Generating docs...'));
      const docs = await generateDocs(analysis, null, config);
      spinner.succeed(chalk.green('Documentation ready!'));

      await exportReport({ analysis, docs, config });
      console.log(chalk.green.bold('\n✅ Done! Documentation exported.'));
    } catch (err) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }
  });

// Refactor-only command
program
  .command('refactor <repo>')
  .description('Analyze code for refactoring opportunities only')
  .option('-o, --output <dir>', 'Output directory', './codedoc-output')
  .option('--severity <level>', 'Min severity: low | medium | high', 'low')
  .option('--model <model>', 'Anthropic model', 'claude-sonnet-4-6')
  .action(async (repo, options) => {
    printBanner(VERSION);
    const config = { ...options, docs: false };
    const spinner = ora();

    try {
      spinner.start(chalk.cyan('Analyzing for refactoring opportunities...'));
      const repoPath = await validateRepo(repo, config);
      const analysis = await analyzeRepo(repoPath, config);
      const refactorReport = await generateRefactorSuggestions(analysis, config);
      spinner.succeed(chalk.green(`Found ${refactorReport.suggestions.length} suggestions`));

      await exportReport({ analysis, refactorReport, config });
      console.log(chalk.green.bold('\n✅ Refactoring report exported.'));
    } catch (err) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }
  });

// Dependency map command
program
  .command('deps <repo>')
  .description('Generate a dependency map visualization')
  .option('-o, --output <dir>', 'Output directory', './codedoc-output')
  .action(async (repo, options) => {
    printBanner(VERSION);
    const config = options;
    const spinner = ora();

    try {
      spinner.start(chalk.cyan('Mapping dependencies...'));
      const repoPath = await validateRepo(repo, config);
      const analysis = await analyzeRepo(repoPath, config);
      const depMap = await generateDependencyMap(analysis, config);
      spinner.succeed(chalk.green('Dependency map complete!'));

      await exportReport({ analysis, depMap, config });
      console.log(chalk.green.bold('\n✅ Dependency map exported.'));
    } catch (err) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
