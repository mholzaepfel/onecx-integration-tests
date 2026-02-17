export default {
  displayName: 'integration-tests',
  snapshotFormat: { escapeString: true, printBasicPrototype: true },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/src/lib/**/*.spec.ts'],
  coverageDirectory: `<rootDir>/reports/coverage`,
}
