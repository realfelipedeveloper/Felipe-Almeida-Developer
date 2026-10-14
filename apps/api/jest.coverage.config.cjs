module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/modules/**/application/*.ts',
    'src/modules/**/domain/*.ts',
    'src/modules/**/presentation/*guard.ts',
    'src/infra/security/*.ts',
    'src/shared/application/*.ts',
    'src/shared/domain/*.ts',
    '!src/**/*.types.ts',
    '!src/**/*.ports.ts',
    '!src/**/application/*-storage.ts',
    '!src/**/application/*-scanner.ts',
    '!src/**/application/*.repository.ts',
    '!src/infra/security/audit-rich-text.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json-summary', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 80,
      lines: 80,
    },
  },
};
