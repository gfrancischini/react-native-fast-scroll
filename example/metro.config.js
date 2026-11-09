const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const pak = require('../package.json');

const root = path.resolve(__dirname, '..');

const modules = Object.keys({
  ...pak.peerDependencies,
});

const escape = (string) => string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

const config = getDefaultConfig(__dirname);

// The library's source lives in the parent folder.
config.watchFolders = [root];

// We need to make sure that only one version is loaded for peerDependencies
// So we block them at the root, and alias them to the versions in example's node_modules
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  ...modules.map(
    (m) => new RegExp(`^${escape(path.join(root, 'node_modules', m))}\\/.*$`)
  ),
];

config.resolver.extraNodeModules = modules.reduce((acc, name) => {
  acc[name] = path.join(__dirname, 'node_modules', name);
  return acc;
}, {});

module.exports = config;
