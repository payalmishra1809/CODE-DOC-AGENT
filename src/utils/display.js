/**
 * Display utilities for terminal output
 */

const chalk = require('chalk');

const BANNER = `
  ██████╗ ██████╗ ██████╗ ███████╗██████╗  ██████╗  ██████╗
 ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔═══██╗██╔════╝
 ██║     ██║   ██║██║  ██║█████╗  ██║  ██║██║   ██║██║
 ██║     ██║   ██║██║  ██║██╔══╝  ██║  ██║██║   ██║██║
 ╚██████╗╚██████╔╝██████╔╝███████╗██████╔╝╚██████╔╝╚██████╗
  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═════╝  ╚═════╝  ╚═════╝`;

function printBanner(version) {
  console.log(chalk.cyan(BANNER));
  console.log(chalk.gray(`  Automated Codebase Documentation & Refactoring Agent  v${version}\n`));
}

function printSummary(analysis, docs, refactorReport, exportResult) {
  const grade = refactorReport?.summary?.healthGrade || 'N/A';
  const gradeColor = { A: 'green', B: 'greenBright', C: 'yellow', D: 'yellow', F: 'red' }[grade] || 'gray';

  console.log('\n' + chalk.bold.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.white('  📊 ANALYSIS SUMMARY'));
  console.log(chalk.bold.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(`  ${chalk.cyan('Files analyzed:')}    ${chalk.white(analysis.totalFiles)}`);
  console.log(`  ${chalk.cyan('Lines of code:')}     ${chalk.white(analysis.totalLines.toLocaleString())}`);
  console.log(`  ${chalk.cyan('Doc files created:')} ${chalk.white(docs?.files?.length || 0)}`);
  console.log(`  ${chalk.cyan('Issues found:')}      ${chalk.white(analysis.allIssues.length)}`);

  if (refactorReport) {
    const s = refactorReport.summary;
    console.log(`  ${chalk.cyan('Refactor hints:')}    ${chalk.white(s.totalSuggestions)} (${chalk.red(s.bySeverity.critical + ' critical')}, ${chalk.yellow(s.bySeverity.high + ' high')})`);
    console.log(`  ${chalk.cyan('Code health:')}       ${chalk[gradeColor].bold(grade)}`);
  }

  console.log(chalk.bold.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(`\n  ${chalk.green.bold('✅ Output saved to:')} ${chalk.underline(exportResult.outputDir)}`);
  console.log(`  ${chalk.gray('Open:')} ${chalk.cyan(exportResult.outputDir + '/index.html')}`);
  console.log();
}

module.exports = { printBanner, printSummary };
