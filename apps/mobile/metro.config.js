const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo support: watch the whole workspace and resolve deps from both roots.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Required for pnpm: packages are symlinked into the store, so Metro must be
// able to walk up from their real location to find their own dependencies
// (e.g. react-native -> invariant).
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
