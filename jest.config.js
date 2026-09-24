module.exports = {
  displayName: 'integration-tests',
  snapshotFormat: { escapeString: true, printBasicPrototype: true },
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'text-summary', 'html'],
  reporters: [
    'default',
    [
      'jest-sonar',
      {
        outputDirectory: 'reports',
        outputName: 'sonarqube_report.xml',
        reportedFilePath: 'absolute',
      },
    ],
  ],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // commander v15 is ESM-only (type: module); the CJS test sandbox (ts-jest)
  // cannot require() it, so let ts-jest compile commander's self-contained
  // ESM files to CJS. Production build/dist are unaffected.
  transformIgnorePatterns: ['node_modules/(?!commander)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/src/lib/**/*.spec.ts', '<rootDir>/src/it-runner/**/*.spec.ts'],
  coverageDirectory: '<rootDir>/reports/coverage',
}
