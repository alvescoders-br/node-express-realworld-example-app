import baseConfig from './jest.config';

export default {
  ...baseConfig,
  displayName: 'api-mutation',
  testMatch: [
    '<rootDir>/src/tests/services/article.service.test.ts',
    '<rootDir>/src/tests/services/bookmark.service.test.ts',
    '<rootDir>/src/tests/services/tag.service.test.ts',
  ],
  collectCoverage: false,
};
