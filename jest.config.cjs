/** Jest runs TS through ts-jest compiled to CommonJS (tsconfig.jest.json) regardless
 * of this package's "type": "module" — avoids ESM/Jest interop entirely. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/server/**/*.test.ts',
    '<rootDir>/server/**/*.test.tsx',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'server/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!server/**/*.test.{ts,tsx}',
    '!src/test/**',
    '!server/test/**',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
