module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  env: {
    // Apps compile this library's `src/` with Reanimated's plugin, which turns
    // worklets into functions that know the shared values they read. Without it
    // animated styles never re-run under Jest. Kept to tests so the published
    // `lib/` build is unchanged.
    test: {
      plugins: ['react-native-reanimated/plugin'],
    },
  },
};
