/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: '@react-native/jest-preset',

  // Map @retail/* to their TypeScript source so Babel can transpile them.
  // This is needed because pnpm workspace symlinks land in node_modules,
  // and Jest's default transformIgnorePatterns would skip them.
  moduleNameMapper: {
    '^@retail/api-client(.*)$':
      '<rootDir>/../../packages/api-client/src/index.ts',
    '^@retail/design-tokens(.*)$':
      '<rootDir>/../../packages/design-tokens/src/index.ts',
  },

  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation)/)',
  ],
};
