// ... existing code ...
// Remove the @testing-library/jest-dom import as it's not needed for utility tests

// Add any global test setup here if needed
global.console = {
  ...console,
  // Comment out error and log in tests to reduce noise
  error: jest.fn(),
  log: jest.fn(),
};
