#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');

// ANSI color codes - only use when in a TTY (terminal)
// GUI git clients (Tower, GitHub Desktop) don't support ANSI codes
const isTTY = process.stderr.isTTY;
const colors = {
  reset: isTTY ? '\x1b[0m' : '',
  red: isTTY ? '\x1b[31m' : '',
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  blue: isTTY ? '\x1b[34m' : '',
  magenta: isTTY ? '\x1b[35m' : '',
  cyan: isTTY ? '\x1b[36m' : '',
  gray: isTTY ? '\x1b[90m' : '',
  bold: isTTY ? '\x1b[1m' : '',
};

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

  // Technical details at top (reference, can scroll back if needed)
  console.error(`${c.gray}🔍 Technical Details (from commitlint):${c.reset}`);
  console.error('');
  const formattedOutput = commitlintOutput
    .split('\n')
    .map((line) => `  ${c.gray}${line}${c.reset}`)
    .join('\n');
  console.error(formattedOutput);
  console.error('\n');

  // Valid types reference (middle section)
  console.error(`${c.cyan}📚 Valid Types:${c.reset}`);
  console.error('');
  console.error(`  ${c.cyan}feat${c.reset}, ${c.cyan}fix${c.reset}, ${c.cyan}docs${c.reset}, ${c.cyan}style${c.reset}, ${c.cyan}refactor${c.reset}, ${c.cyan}perf${c.reset}, ${c.cyan}test${c.reset}, ${c.cyan}build${c.reset}, ${c.cyan}ci${c.reset}, ${c.cyan}chore${c.reset}, ${c.cyan}revert${c.reset}`);
  console.error('\n');

  // Examples (fewer, more focused)
  console.error(`${c.green}📝 Examples:${c.reset}`);
  console.error('');
  console.error(`  ${c.green}✓${c.reset} feat(timer): add pause functionality`);
  console.error(`  ${c.green}✓${c.reset} fix(state): resolve cross-tab sync issue`);
  console.error(`  ${c.green}✓${c.reset} docs: update installation instructions`);
  console.error('\n');

  // BOTTOM: Quick fix section (always visible after scroll)
  console.error(`${c.yellow}╔═══════════════════════════════════════════════════════════════╗${c.reset}`);
  console.error(`${c.yellow}║  💡 QUICK FIX                                                  ║${c.reset}`);
  console.error(`${c.yellow}╚═══════════════════════════════════════════════════════════════╝${c.reset}`);
  console.error('\n');
  console.error(`${c.bold}Format:${c.reset} ${c.cyan}type${c.reset}${c.gray}(${c.reset}${c.cyan}scope${c.reset}${c.gray})${c.reset}${c.cyan}: subject${c.reset} ${c.gray}(all lowercase, scope required)${c.reset}`);
  console.error('');
  console.error(`${c.red}You wrote:${c.reset}     "${commitMessage}"`);
  console.error(`${c.green}Try instead:${c.reset}  "${suggestFix(commitMessage)}"`);
  console.error('\n');
  console.error(`${c.gray}Scope = what part of codebase (e.g., timer, state, ui)${c.reset}`);
  console.error('\n');
}

function suggestFix(commitMessage) {
  // Simple suggestion: lowercase the message
  let fixed = commitMessage.toLowerCase();

  // If it doesn't have a colon, suggest adding one with scope
  if (!fixed.includes(':')) {
    return `fix(scope): ${fixed}`;
  }

  // Map common mistakes to correct types
  const typeMap = {
    feature: 'feat',
    bugfix: 'fix',
    bug: 'fix',
    documentation: 'docs',
    document: 'docs',
    testing: 'test',
    tests: 'test',
  };

  // Try to fix common type mistakes
  const colonIndex = fixed.indexOf(':');
  if (colonIndex > 0) {
    const typeAndScope = fixed.substring(0, colonIndex);
    const subject = fixed.substring(colonIndex);

    // Extract just the type (before any parenthesis)
    const parenIndex = typeAndScope.indexOf('(');
    const type = parenIndex > 0 ? typeAndScope.substring(0, parenIndex) : typeAndScope;
    const scope = parenIndex > 0 ? typeAndScope.substring(parenIndex) : '';

    // If the type has a mapping, replace it
    if (typeMap[type]) {
      const scopePart = scope || '(scope)';
      fixed = `${typeMap[type]}${scopePart}${subject}`;
    } else if (!scope) {
      // No scope present, add a placeholder
      fixed = `${type}(scope)${subject}`;
    }
  }

  return fixed;
}

main();
