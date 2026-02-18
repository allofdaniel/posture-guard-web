# Accessibility Testing Guide

## Quick Start

Run all accessibility tests:
```bash
npm run test:e2e -- accessibility.spec.js
```

Run in UI mode for visual debugging:
```bash
npm run test:e2e:ui -- accessibility.spec.js
```

## Test Suites

### 1. Interactive Elements - Accessible Names
Tests that all buttons, links, and controls have accessible names via aria-label or text content.

**Run only this suite:**
```bash
npx playwright test -g "Interactive Elements"
```

**What it tests:**
- Header buttons (stats, settings) have aria-label
- Calibration button has text content
- Monitoring controls have aria-labels
- All buttons are keyboard accessible

### 2. Modal Accessibility
Tests ARIA attributes on all modals (Settings, Stats, History, Break Reminder).

**Run only this suite:**
```bash
npx playwright test -g "Modal Accessibility"
```

**What it tests:**
- role="dialog" attribute
- aria-modal="true" attribute
- aria-labelledby pointing to title
- Close button has aria-label

### 3. Modal Focus Management
Tests focus behavior when opening and closing modals.

**Run only this suite:**
```bash
npx playwright test -g "Modal Focus Management"
```

**What it tests:**
- Focus moves to modal on open
- Focus returns to trigger button on close
- Focus trap (Tab cycles within modal)
- Reverse navigation (Shift+Tab)

### 4. Keyboard Navigation - Escape Key
Tests that Escape key closes modals and restores focus.

**Run only this suite:**
```bash
npx playwright test -g "Escape Key"
```

**What it tests:**
- Escape closes Settings modal
- Escape closes Stats modal
- Focus returns to trigger button after Escape

### 5. Keyboard Navigation - Tab Order
Tests tab navigation through the app.

**Run only this suite:**
```bash
npx playwright test -g "Tab Order"
```

**What it tests:**
- Tab through header elements
- All interactive elements are reachable
- No keyboard traps
- Logical tab order

### 6. ARIA Roles and Landmarks
Tests semantic HTML and ARIA landmarks.

**Run only this suite:**
```bash
npx playwright test -g "ARIA Roles"
```

**What it tests:**
- header has role="banner"
- main has role="main"
- Button groups have role="group"
- Dialogs have role="dialog"
- Presentation role on backdrops

### 7. Images and Media
Tests alt text and ARIA attributes on images, video, and canvas.

**Run only this suite:**
```bash
npx playwright test -g "Images and Media"
```

**What it tests:**
- Video has aria-hidden="true"
- Canvas has aria-label and role="img"
- Decorative icons have aria-hidden

### 8. Form Controls and Labels
Tests that all form inputs have proper labels.

**Run only this suite:**
```bash
npx playwright test -g "Form Controls"
```

**What it tests:**
- Range sliders have aria-label
- Number inputs have aria-label
- All inputs have labels or aria-label
- Form controls are keyboard accessible

### 9. Button States
Tests button state attributes.

**Run only this suite:**
```bash
npx playwright test -g "Button States"
```

**What it tests:**
- Disabled buttons have disabled attribute
- Toggle buttons use aria-pressed
- Active states have semantic indication

### 10. Screen Reader Support
Tests screen reader compatibility.

**Run only this suite:**
```bash
npx playwright test -g "Screen Reader"
```

**What it tests:**
- Page has lang attribute
- Meaningful content is not hidden
- Status messages are accessible
- Logical heading hierarchy

### 11. Mobile Accessibility
Tests accessibility on mobile viewports.

**Run only this suite:**
```bash
npx playwright test -g "Mobile Accessibility"
```

**What it tests:**
- Touch targets are 44x44px minimum
- Modals work on mobile
- ARIA attributes work on mobile

## Running Specific Tests

### Run a single test
```bash
npx playwright test -g "focus moves to modal when opened"
```

### Run tests matching a pattern
```bash
npx playwright test -g "modal"
```

### Run only on specific browser
```bash
npx playwright test --project=chromium accessibility.spec.js
```

### Run only on mobile
```bash
npx playwright test --project=mobile-chrome accessibility.spec.js
```

## Debugging Failed Tests

### 1. View the HTML report
```bash
npm run test:e2e:report
```

### 2. Run in headed mode (see browser)
```bash
npx playwright test --headed accessibility.spec.js
```

### 3. Debug specific test
```bash
npx playwright test --debug -g "focus returns to trigger"
```

### 4. Slow down test execution
```bash
npx playwright test --headed --slow-mo=1000 accessibility.spec.js
```

## Common Issues and Fixes

### Issue: Tests timeout waiting for elements

**Solution:** The app needs time to load MediaPipe. Timeouts are already set to 10-20 seconds. If still failing, increase:
```javascript
await page.waitForSelector('.app', { timeout: 30000 });
```

### Issue: Focus management tests fail

**Solution:** Add small delay after modal open/close:
```javascript
await page.waitForTimeout(100);
```

### Issue: Modal not found

**Solution:** Make sure the modal is actually open:
```javascript
await page.waitForSelector('[role="dialog"]', { state: 'visible' });
```

### Issue: Camera permission errors

**Solution:** The `beforeEach` hook should grant permissions:
```javascript
await context.grantPermissions(['camera']);
```

## WCAG 2.1 AA Compliance Checklist

### Level A
- [x] 1.1.1 Non-text Content (images have alt text)
- [x] 1.3.1 Info and Relationships (semantic HTML, ARIA)
- [x] 1.3.2 Meaningful Sequence (logical tab order)
- [x] 1.3.3 Sensory Characteristics (not relying on shape/color alone)
- [x] 2.1.1 Keyboard (all functionality via keyboard)
- [x] 2.1.2 No Keyboard Trap (focus can escape)
- [x] 2.4.1 Bypass Blocks (landmarks for navigation)
- [x] 2.4.2 Page Titled (page has title)
- [x] 3.1.1 Language of Page (html lang attribute)
- [x] 3.2.1 On Focus (no unexpected changes)
- [x] 3.2.2 On Input (no unexpected changes)
- [x] 3.3.2 Labels or Instructions (form labels)
- [x] 4.1.1 Parsing (valid HTML)
- [x] 4.1.2 Name, Role, Value (ARIA attributes)

### Level AA
- [x] 1.3.4 Orientation (works in any orientation)
- [x] 1.3.5 Identify Input Purpose (input autocomplete)
- [x] 1.4.3 Contrast (Minimum) - **Already fixed**
- [x] 1.4.5 Images of Text (using actual text)
- [x] 1.4.10 Reflow (responsive design)
- [x] 1.4.11 Non-text Contrast (UI components contrast)
- [x] 2.4.3 Focus Order (logical focus order)
- [x] 2.4.6 Headings and Labels (descriptive labels)
- [x] 2.4.7 Focus Visible (visible focus indicator)
- [x] 2.5.3 Label in Name (visible label matches accessible name)
- [x] 2.5.4 Motion Actuation (no motion-only controls)
- [x] 4.1.3 Status Messages (announcements for screen readers)

## Manual Testing Required

Some accessibility criteria require manual testing with assistive technology:

### Screen Reader Testing
Test with:
- **Windows:** NVDA (free) or JAWS
- **macOS:** VoiceOver (built-in)
- **Mobile:** TalkBack (Android) or VoiceOver (iOS)

**What to test:**
- All text is read correctly
- Button labels are clear
- Modal announcements work
- Form inputs have labels
- Status changes are announced

### Keyboard-Only Testing
Test without a mouse:
- Tab through entire app
- Open/close all modals
- Navigate forms
- Activate all buttons
- Ensure no keyboard traps

### Zoom Testing
Test at 200% and 400% zoom:
- Content reflows correctly
- No horizontal scrolling
- All functionality remains available
- Text remains readable

### High Contrast Mode
Test in Windows High Contrast Mode:
- All content visible
- Focus indicators visible
- Buttons distinguishable
- Text readable

## Continuous Testing

### Pre-commit Hook
Add to `.git/hooks/pre-commit`:
```bash
#!/bin/sh
npm run test:e2e -- accessibility.spec.js
```

### CI/CD Integration
Add to GitHub Actions (`.github/workflows/accessibility.yml`):
```yaml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e -- accessibility.spec.js
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Resources](https://webaim.org/resources/)
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)

## Getting Help

If you need help with accessibility:
1. Check this guide first
2. Review the test file comments
3. Check the main README.md
4. Consult WCAG 2.1 documentation
5. Ask in the project issues
