# Testing Guide

Test infrastructure for the Home Tab web client, organized by test type with all output contained in `results/`.

## Directory Structure

```
tests/
├── smoke/              # Fast critical path tests (~2-5 min)
├── e2e/                # Full end-to-end test scenarios
├── visual/             # Visual regression tests
└── results/            # All test output (gitignored)
    ├── playwright-report/    # HTML test report
    └── test-results/         # Test artifacts, traces, screenshots
```

---

## Test Types

### Smoke Tests (`smoke/`)

**Purpose:** Fast tests that verify critical user paths work. Run before deployment.

**Examples:**
- App loads without errors
- Core features are visible (timer, weather, etc.)
- Basic navigation works

**When to run:**
- Before every commit (pre-push hook)
- On push to main (CI)
- Before production deployment

**Command:**
```bash
pnpm test:e2e:smoke
```

**Expected runtime:** ~2-5 minutes

---

### E2E Tests (`e2e/`)

**Purpose:** Comprehensive end-to-end scenarios that test complete user workflows.

**Examples:**
- Timer full lifecycle (start, pause, reset, complete)
- Cross-tab sync verification
- Preferences persistence across reload
- Error state handling

**When to run:**
- Nightly (CI)
- After merging to main
- Before major releases

**Command:**
```bash
pnpm test:e2e:full
```

**Expected runtime:** ~10-20 minutes (full suite, all browsers)

---

### Visual Regression (`visual/`)

**Purpose:** Catch unintended visual changes (CSS, layout, rendering issues).

**How it works:**
- Captures screenshots of key UI states
- Compares against baseline images in `visual/*-snapshots/`
- Fails if visual differences detected

**Baselines:**
- Stored in `visual/*-snapshots/` directories
- **Committed to git** (not in results/)
- Updated via `pnpm test:visual`

**When to run:**
- On pull requests (CI)
- After UI/CSS changes
- When updating baseline screenshots

**Commands:**
```bash
# Run visual tests (compare against baselines)
pnpm --filter @clients/web playwright test visual/

# Update baselines (after intentional UI changes)
pnpm test:visual
```

---

## Running Tests

### Local Development

```bash
# Smoke tests (fast)
pnpm test:e2e:smoke

# Full E2E suite
pnpm test:e2e:full

# Visual regression (update baselines)
pnpm test:visual

# Interactive UI mode (debug tests visually)
pnpm test:e2e:ui
```

### Debugging

**Playwright UI Mode** (recommended):
```bash
pnpm test:e2e:ui
```
- Time travel through test execution
- Inspect DOM at any point
- See network requests, console logs
- Visually debug selectors

**View HTML Report:**
```bash
open tests/results/playwright-report/index.html
```

**Inspect Failed Tests:**
- Screenshots: `tests/results/test-results/*/test-failed-*.png`
- Traces: `tests/results/test-results/*/*.zip`

---

## Configuration

### Playwright Config ([playwright.config.ts](../playwright.config.ts))

Key settings:
- **Base URL:** `http://localhost:5176` (matches dev server port)
- **Browsers:** Chromium + Firefox
- **Output:** All results contained in `tests/results/`
- **Retries:** 2 retries in CI, 0 locally
- **Workers:** 1 in CI (serial), parallel locally

### Test Isolation

Each test runs in a fresh browser context:
- Clean localStorage
- No cookies/session from previous tests
- Independent state

### Dev Server

Playwright automatically:
- Starts `pnpm dev` before tests
- Waits for `http://localhost:5176` to be ready
- Reuses existing server if already running
- Kills server after tests complete

---

## Writing Tests

### Smoke Test Example

```typescript
import { test, expect } from "@playwright/test"

test("feature X works", async ({ page }) => {
  await page.goto("/")

  // Verify critical element is visible
  await expect(page.locator('[data-testid="feature-x"]')).toBeVisible()

  // Test basic interaction
  await page.click('[data-testid="button"]')
  await expect(page.locator('[data-testid="result"]')).toHaveText(/success/i)
})
```

### E2E Test Example

```typescript
import { test, expect } from "@playwright/test"

test("timer complete workflow", async ({ page }) => {
  await page.goto("/")

  // Start timer
  await page.click('[data-testid="timer-start"]')
  await expect(page.locator('[data-testid="timer-status"]')).toHaveText("Running")

  // Pause timer
  await page.click('[data-testid="timer-pause"]')
  await expect(page.locator('[data-testid="timer-status"]')).toHaveText("Paused")

  // Reset timer
  await page.click('[data-testid="timer-reset"]')
  await expect(page.locator('[data-testid="timer-time"]')).toHaveText("25:00")
})
```

### Visual Test Example

```typescript
import { test, expect } from "@playwright/test"

test("component visual baseline", async ({ page }) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")

  // Capture full page
  await expect(page).toHaveScreenshot("page-name.png", { fullPage: true })

  // Or capture specific element
  const component = page.locator('[data-testid="component"]')
  await expect(component).toHaveScreenshot("component-state.png")
})
```

### Cross-Tab Testing

Playwright can open multiple browser contexts to test cross-tab sync:

```typescript
test("state syncs across tabs", async ({ context }) => {
  const tab1 = await context.newPage()
  const tab2 = await context.newPage()

  await tab1.goto("/")
  await tab2.goto("/")

  // Change state in tab 1
  await tab1.click('[data-testid="button"]')

  // Verify tab 2 reflects the change
  await expect(tab2.locator('[data-testid="status"]')).toHaveText("Updated")
})
```

---

## Best Practices

### DO:
- ✅ Use `data-testid` attributes for stable selectors
- ✅ Test user-facing behavior, not implementation
- ✅ Wait for elements with `waitFor()` or `expect().toBeVisible()`
- ✅ Use descriptive test names
- ✅ Keep smoke tests fast (<5 min total)
- ✅ Group related assertions in single test when appropriate

### DON'T:
- ❌ Use fragile selectors (CSS classes, deep nesting)
- ❌ Test implementation details
- ❌ Add artificial waits (`page.waitForTimeout()`)
- ❌ Make tests dependent on execution order
- ❌ Put comprehensive tests in smoke/ (keep it fast!)

---

## CI/CD Integration

### Pull Requests
- Smoke tests
- Visual regression (manual approval for differences)
- Component tests (via Vitest)

### Push to Main
- All smoke tests
- Full E2E suite (async, doesn't block)

### Nightly
- Full E2E suite across all browsers
- Coverage reports

---

## Troubleshooting

### Tests timing out
- Check dev server is running on correct port (5176)
- Increase timeout in playwright.config.ts if needed
- Use `test:e2e:ui` to debug visually

### Visual tests failing
- Review diff images in test report
- If change is intentional: run `pnpm test:visual` to update baselines
- Commit updated baseline screenshots

### Flaky tests
- Add explicit waits: `await page.locator(...).waitFor()`
- Use `test.retry()` for inherently flaky scenarios
- Check for race conditions in test logic

### Cross-tab tests not working
- Ensure `localStorage` is cleared between tests
- Verify sync logic handles rapid updates
- Use `page.waitForTimeout()` sparingly (prefer event-driven waits)

---

## Related Documentation

- [Playwright Docs](https://playwright.dev)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Project Testing Strategy](../../../.claude/plans/testing-strategy_tmp.html)
- [State Tests](../../../data/state/timer/timer.test.ts) - Example of Zustand store testing
