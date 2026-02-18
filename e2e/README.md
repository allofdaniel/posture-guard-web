# E2E Tests for Posture Guard Web

This directory contains end-to-end tests for the Posture Guard PWA using Playwright.

## Directory Structure

```
e2e/
├── fixtures/
│   ├── base.js              # Custom test fixture with camera and MediaPipe mocks
│   └── mediapipe-mock.js    # MediaPipe mock utilities and pose data generators
├── tests/
│   ├── app.spec.js          # Main application test suite
│   └── navigation.spec.js   # UI navigation and modal tests
├── accessibility.spec.js    # WCAG 2.1 AA accessibility compliance tests
└── README.md                # This file
```

## Test Files

### `tests/app.spec.js`
Comprehensive application tests:
- Application loading and initialization
- Camera permissions and video feed
- Pose detection functionality
- Good/poor posture detection
- Session statistics tracking
- PWA capabilities (installability, offline mode)
- Error handling for camera failures
- Session start/stop controls

### `tests/navigation.spec.js`
Tests for UI navigation and modal interactions:
- App initialization and loading screen
- Navigation between app states (calibrating → monitoring → result)
- Modal opening/closing (Settings, Stats, History)
- Basic UI element visibility and accessibility
- Responsive design on different viewports
- Error handling for camera failures

### `accessibility.spec.js`
Comprehensive WCAG 2.1 AA accessibility compliance tests:
- Interactive elements with accessible names (aria-label, text content)
- Modal accessibility (role="dialog", aria-modal, aria-labelledby)
- Focus management (focus trap, focus restoration)
- Keyboard navigation (Tab, Shift+Tab, Escape)
- ARIA roles and landmarks (banner, main, group, dialog)
- Images and media accessibility (alt text, aria-hidden)
- Form controls with proper labels
- Button states (disabled, aria-pressed)
- Screen reader support
- Mobile accessibility (touch targets, viewport testing)

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test e2e/navigation.spec.js
```

### Run specific test by name
```bash
npx playwright test -g "should open settings modal"
```

## Test Fixtures

### Base Fixture (`fixtures/base.js`)

The base fixture provides automatic setup for all tests:
- Grants camera permissions automatically
- Mocks `getUserMedia` with a fake video stream
- Mocks MediaPipe `PoseLandmarker` class with realistic pose data
- Pre-navigates to the application
- Configures page and context for PWA testing

Usage:
```javascript
import { test, expect } from '../fixtures/base.js';

test('my test', async ({ page }) => {
  // page is already set up with camera mocks
  // and navigated to the app
});
```

### MediaPipe Mock Utilities (`fixtures/mediapipe-mock.js`)

Provides helper functions for simulating different posture scenarios:
- `getGoodPostureLandmarks()` - Generate good posture pose data
- `getPoorPostureLandmarks()` - Generate poor posture pose data (forward head)
- `getNoPersonLandmarks()` - Generate empty pose data (no person detected)
- `injectPoseLandmarks(page, landmarks)` - Inject custom pose data into the page
- `waitForPoseDetection(page)` - Wait for pose detection to initialize
- `simulateGoodPostureSession(page, seconds)` - Simulate good posture for duration
- `simulatePoorPostureSession(page, seconds)` - Simulate poor posture for duration

Usage:
```javascript
import { test, expect } from '../fixtures/base.js';
import { simulateGoodPostureSession } from '../fixtures/mediapipe-mock.js';

test('detect good posture', async ({ page }) => {
  await simulateGoodPostureSession(page, 5);
  // Assert good posture is detected
});
```

## Test Features

### Camera Mocking
All tests mock the camera API to avoid requiring actual camera permissions:
- `getUserMedia` is mocked to return a fake video stream (via base fixture)
- MediaPipe pose detection is mocked to provide fake landmark data
- Camera permissions are granted automatically in test context
- Chromium launch flags provide fake media devices

### Test Coverage

#### Navigation Tests
- ✅ Initial app load and loading screen
- ✅ Canvas and video element rendering
- ✅ Calibration view UI elements
- ✅ Settings modal (open, close, sections, theme changes)
- ✅ Stats modal (open, close, summary cards, view toggle)
- ✅ Header buttons and navigation
- ✅ ARIA labels and accessibility
- ✅ Error handling for camera failures
- ✅ Responsive design (mobile, tablet viewports)
- ✅ Modal state management

#### Accessibility Tests (WCAG 2.1 AA)
- ✅ All interactive elements have accessible names
- ✅ Modals have correct ARIA attributes (role, aria-modal, aria-labelledby)
- ✅ Focus moves to modal on open
- ✅ Focus returns to trigger button on close
- ✅ Focus is trapped within modal
- ✅ Escape key closes modals
- ✅ Tab navigation works throughout the app
- ✅ Shift+Tab reverse navigation works
- ✅ Landmarks (header, main) have correct roles
- ✅ Button groups have role="group" with aria-label
- ✅ Video has aria-hidden (hidden from screen readers)
- ✅ Canvas has aria-label and role="img"
- ✅ Range inputs have aria-label
- ✅ Number inputs have aria-label
- ✅ All form inputs have associated labels
- ✅ Disabled buttons have disabled attribute
- ✅ Toggle buttons use aria-pressed
- ✅ Page has language attribute
- ✅ Meaningful content is accessible to screen readers
- ✅ Mobile touch targets meet minimum size (44x44px)

### Browser Support
Tests run on:
- Desktop Chrome (Chromium)
- Mobile Chrome (Pixel 5 viewport)

Additional browsers can be enabled in `playwright.config.js`.

## Test Structure

Each test suite follows this pattern:

1. **beforeEach**:
   - Grants camera permissions
   - Mocks getUserMedia and MediaPipe APIs
   - Navigates to the app

2. **Test Cases**:
   - Wait for elements with appropriate timeouts
   - Use semantic selectors (ARIA labels, text content)
   - Verify visibility and state of UI elements
   - Test user interactions (clicks, navigation)

## Debugging Tests

### Visual Debugging
```bash
npm run test:e2e:ui
```

Opens Playwright's interactive UI where you can:
- Step through tests
- See browser state at each step
- Time-travel through test execution
- View screenshots and traces

### Debug Mode
```bash
npx playwright test --debug
```

Opens browser with Playwright Inspector for step-by-step debugging.

### View Test Report
After running tests, view the HTML report:
```bash
npx playwright show-report
```

## Writing New Tests

### Test Template
```javascript
test('should do something', async ({ page }) => {
  // Wait for element
  await page.waitForSelector('.some-element', { timeout: 20000 });

  // Interact with element
  await page.locator('button:has-text("Click Me")').click();

  // Verify result
  await expect(page.locator('.result')).toBeVisible();
});
```

### Best Practices
1. Use semantic selectors when possible (ARIA labels, text content)
2. Set appropriate timeouts for MediaPipe loading (15-20 seconds)
3. Mock camera and MediaPipe APIs in beforeEach
4. Test user flows, not implementation details
5. Use meaningful test descriptions in Korean where appropriate
6. Add accessibility checks (ARIA attributes, keyboard navigation)

## CI/CD Integration

Tests are configured to run in CI with:
- 2 retries on failure
- Single worker for stability
- Video recording on failure
- Screenshot on failure
- HTML and list reporters

## Troubleshooting

### Tests timeout during loading
- Increase timeout in test: `{ timeout: 30000 }`
- Check MediaPipe loading in browser console
- Verify dev server is running on port 5173

### Camera permission errors
- Ensure `beforeEach` hook mocks getUserMedia
- Check context permissions are granted
- Verify browser launch args include fake media stream flags

### Flaky tests
- Add appropriate wait conditions
- Use `waitForSelector` instead of fixed delays
- Ensure state is reset between tests

## Further Reading

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Web Apps](https://playwright.dev/docs/test-webfirst)
