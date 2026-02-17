const nxPreset = require('@nx/jest/preset').default

module.exports = {
  ...nxPreset,
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
}
