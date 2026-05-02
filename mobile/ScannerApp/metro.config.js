const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration for pnpm workspace.
 * Adds the monorepo root to watchFolders so Metro can resolve
 * @retail/api-client and @retail/design-tokens workspace packages.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// Root of the Pharmadistributionmanagementsystem monorepo
const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

const workspaceConfig = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), workspaceConfig);
