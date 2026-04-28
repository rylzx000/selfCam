module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/specs/**/*.spec.js'],
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  testTimeout: 120000,
  maxWorkers: 1,
  verbose: true
}
