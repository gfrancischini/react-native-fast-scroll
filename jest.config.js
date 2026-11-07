/** @type {import('jest').Config} */
module.exports = {
  // RNTL's preset = the `react-native` preset, but it restores the native
  // Promise that RN 0.70 replaces with a setImmediate-based polyfill. Without
  // it, `userEvent` never resolves under `jest.useFakeTimers()`.
  preset: '@testing-library/react-native',
  // Custom environment so React Native's jest setup can run on Node >= 18
  // (it overwrites `global.performance`, which is read-only there).
  testEnvironment: '<rootDir>/jest/environment.js',
  setupFiles: ['<rootDir>/jest/setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest/setupAfterEnv.js'],
  // RN's mocked native methods (e.g. ScrollView#scrollTo) are shared jest.fn()s.
  clearMocks: true,
  // Animation / gesture libraries ship untranspiled sources and must go through babel.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-reanimated|react-native-gesture-handler|react-native-redash|@shopify/flash-list)/)',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/example/node_modules',
    '<rootDir>/lib/',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/example/',
    '<rootDir>/lib/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__fixtures__/**',
  ],
};
