#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// Valid commit types from conventional commits
const validTypes = [
  { type: 'feat', desc: 'A new feature' },
  { type: 'fix', desc: 'A bug fix' },
  { type: 'docs', desc: 'Documentation changes' },
  { type: 'style', desc: 'Code style changes (formatting, etc.)' },
  { type: 'refactor', desc: 'Code changes that neither fix bugs nor add features' },
  { type: 'perf', desc: 'Performance improvements' },
  { type: 'test', desc: 'Adding or updating tests' },
  { type: 'build', desc: 'Build system or dependency changes' },
  { type: 'ci', desc: 'CI configuration changes' },
  { type: 'chore', desc: 'Other changes (tooling, etc.)' },
  { type: 'revert', desc: 'Revert a previous commit' },
];

function main() {
  const commitMsgFile = process.argv[2];

  if (!commitMsgFile) {
    console.error('Error: No commit message file provided');
    process.exit(1);
  }

  // Read the commit message
  let commitMessage = '';
  try {
    commitMessage = readFileSync(commitMsgFile, 'utf8').trim();
  } catch (error) {
    console.error(`Error reading commit message file: ${error.message}`);
    process.exit(1);
  }

  // Run commitlint
  const result = spawnSync('pnpm', ['commitlint', '--edit', commitMsgFile], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  // If commitlint passed, exit silently
  if (result.status === 0) {
    process.exit(0);
  }

  // Commitlint failed - format the error message
  displayEnhancedError(commitMessage, result.stderr || result.stdout);
  process.exit(1);
}

function displayEnhancedError(commitMessage, commitlintOutput) {
  const c = colors;

  console.error('\n');
  console.error(`${c.red}╔═══════════════════════════════════════════════════════════════╗${c.reset}`);
  console.error(`${c.red}║  ❌ COMMIT MESSAGE FORMAT ERROR                                ║${c.reset}`);
  console.error(`${c.red}╚═══════════════════════════════════════════════════════════════╝${c.reset}`);
  console.error('\n');

  // Show the commit message
  console.error(`${c.bold}Your commit message:${c.reset}`);
  console.error(`  ${c.yellow}"${commitMessage}"${c.reset}`);
  console.error('\n');

  // Parse and show problems
  const problems = parseProblems(commitlintOutput);
  if (problems.length > 0) {
    console.error(`${c.red}❌ Problems detected:${c.reset}`);
    problems.forEach((problem) => {
      console.error(`  ${c.red}•${c.reset} ${problem}`);
    });
    console.error('\n');
  }

  // Show expected format
  console.error(`${c.green}✅ Expected format:${c.reset}`);
  console.error('');
  console.error(`  ${c.cyan}type${c.reset}${c.gray}(${c.reset}${c.cyan}scope${c.reset}${c.gray})${c.reset}${c.cyan}: subject${c.reset}`);
  console.error('');
  console.error('  Where:');
  console.error(`  ${c.gray}•${c.reset} ${c.cyan}type${c.reset}:    one of the valid commit types (required)`);
  console.error(`  ${c.gray}•${c.reset} ${c.cyan}scope${c.reset}:   what part of the codebase (optional)`);
  console.error(`  ${c.gray}•${c.reset} ${c.cyan}subject${c.reset}: brief description in lowercase (required)`);
  console.error('\n');

  // Show examples
  console.error(`${c.green}📝 Valid Examples:${c.reset}`);
  console.error('');
  console.error(`  ${c.green}✓${c.reset} feat(timer): add pause functionality`);
  console.error(`  ${c.green}✓${c.reset} fix(state): resolve cross-tab sync race condition`);
  console.error(`  ${c.green}✓${c.reset} docs(readme): update installation instructions`);
  console.error(`  ${c.green}✓${c.reset} refactor(utilities): simplify time derivation helpers`);
  console.error(`  ${c.green}✓${c.reset} test(timer): add integration tests for persistence`);
  console.error('\n');

  // Show valid types
  console.error(`${c.cyan}📚 Valid Types:${c.reset}`);
  console.error('');
  validTypes.forEach(({ type, desc }) => {
    const paddedType = type.padEnd(10);
    console.error(`  ${c.cyan}${paddedType}${c.reset} - ${desc}`);
  });
  console.error('\n');

  // Show technical details
  console.error(`${c.gray}🔍 Technical Details (from commitlint):${c.reset}`);
  console.error('');
  const formattedOutput = commitlintOutput
    .split('\n')
    .map((line) => `  ${c.gray}${line}${c.reset}`)
    .join('\n');
  console.error(formattedOutput);
  console.error('\n');
  console.error(`${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
  console.error('\n');

  // Show tip
  console.error(`${c.yellow}💡 Tip: Use lowercase for everything!${c.reset}`);
  console.error('\n');
}

function parseProblems(commitlintOutput) {
  const problems = [];
  const lines = commitlintOutput.split('\n');

  for (const line of lines) {
    // Look for lines starting with ✖
    if (line.includes('✖')) {
      // Extract the message after ✖
      const match = line.match(/✖\s+(.+)/);
      if (match) {
        const problem = match[1].trim();
        // Clean up the problem message
        const cleanProblem = problem
          .replace(/\[.*?\]/g, '') // Remove rule names in brackets
          .trim();
        if (cleanProblem) {
          problems.push(cleanProblem);
        }
      }
    }
  }

  return problems;
}

main();
