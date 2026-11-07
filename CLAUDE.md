# react-native-fast-scroll

A published React Native library (pure TypeScript, no native code) with three
fast-scroll components for long sectioned lists, typically a FlashList:
`FastScrollIndicator`, `FastScrollSectionDots`, `FastScrollSectionTab`. The
public API is whatever `src/index.tsx` exports.

## Testing

Read [docs/unit-testing.md](docs/unit-testing.md) before writing or changing a
test, or touching `jest.config.js` / `jest/`. It owns the test rules and explains
the environment wiring (Reanimated runs for real, gesture driving, Node >= 18
workaround).

## Done gate

A change is done when `yarn test`, `yarn typecheck` and `yarn lint` all pass.
CI runs the same three plus `yarn prepack` (bob build). Test files are covered
by typecheck and lint too.

## Conventions worth knowing

- **Section model.** Every component turns `stickyHeaderIndices` or
  `stickyHeaderIndicesWithData` into `SectionFullData` via
  `createFullSectionData` (`src/utils.ts`): `index` is the header's position in
  the list, `startIndex` (`index + 1`) is its first item, `sectionIndex` is the
  section's order among sections. Header taps (tabs, dots) scroll to `index`;
  full-list item taps scroll to `startIndex`.
- **Imperative handles are the integration point.** Apps call
  `onViewableIndexChanged` / `onScrollToOffsetPercentage` on a ref from their
  list's callbacks. Treat handle names and signatures as public API.
- **Minimum peer versions are the target.** Code must run on
  `react-native-reanimated` 2.12 and `react-native-gesture-handler` 2.8 (the
  dev dependencies), which is why it uses `useAnimatedGestureHandler` with the
  old `PanGestureHandler`. Use APIs available in those versions.
- **Worklets.** Helpers called from gesture handlers or animated styles carry a
  `'worklet'` directive (`src/FastScrollSectionDots/utils.ts`) and cross back to
  JS with `runOnJS`. Keep new UI-thread helpers pure and marked the same way.
- **`src/` ships to npm.** Only `__tests__`, `__fixtures__` and `__mocks__` are
  excluded from the package, so test-only code lives in those directories.
- **Pinned React.** `react` 18.1.0, `react-native` 0.70.6; `react-test-renderer`
  must equal the `react` version exactly.
- **Example app** (`example/`, Expo 47) has its own `node_modules`; install it
  with `yarn bootstrap`. It consumes `src/` directly, so library edits show up
  without a build.
- Commits follow Conventional Commits; releases go through `release-it`
  (`yarn release` publishes to npm - only run it when asked).
