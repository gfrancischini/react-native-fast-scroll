# react-native-fast-scroll

A published React Native library (pure TypeScript, no native code) with three
fast-scroll components for long sectioned lists, typically a FlashList:
`FastScrollIndicator`, `FastScrollSectionDots`, `FastScrollSectionTab`. The
public API is whatever `src/index.tsx` exports.

## Production usage

The main consumer is a production app that runs React 18.3, RN 0.77,
Reanimated 3.17, Gesture Handler 2.24 and FlashList v2, on library version
0.3.2. A change that breaks the scenarios below is a regression even if this
repo's tests pass.

**Sectioned catalog list** - the main scenario. One FlashList of product rows
grouped by category, with both components layered over it:

- **Sections.** One `Section` per category, `index` = the category's header
  row. Each section object carries extra app-specific fields the library does
  not declare, and `text` is a component that reads them from the `section`
  prop. So `createFullSectionData` must keep spreading unknown fields through,
  and `text` as a component receiving `{ section, isActive }` must keep working.
  Per-section `dotColor` is used to highlight one section.
- **`FastScrollSectionDots`** on the left. Its `onScrollToIndex` calls FlashList
  `scrollToIndex` on the header `index` with a `viewOffset` for a collapsible
  header above the list, then retries once. The dots always render.
- **`FastScrollIndicator`** on the right, behind a runtime feature flag (on by
  default). `scrollToOffsetPercentage` maps 0..1 to FlashList `scrollToOffset`
  over the scrollable height (content height minus viewport height).
- **Handle calls.** Every `onScroll` frame calls `onScrollToOffsetPercentage` on
  both components, so that path has to stay cheap. `onViewableIndexChanged` is
  called with the first viewable index, debounced 500 ms by the app.
- Both use `hideFastScrollIndicatorTimeout` 2000. Sections can be collapsed,
  which keeps header indices stable but hides the rows between them.

**Generic list wrapper** - a shared FlashList wrapper renders a right-side
`FastScrollIndicator` over every list in the app, wired the same way.

`FastScrollSectionTab` is not used in production.

The app imports `SectionFullData` from the deep path
`react-native-fast-scroll/src/types`, so moving or renaming `src/types.ts` (or
that type) breaks it, even though the type is also exported from the root.

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
- **Two version targets.** Code must run on the minimum peers this repo
  develops against (`react-native-reanimated` 2.12, `react-native-gesture-handler`
  2.8, the dev dependencies) and on the versions production runs
  (see above). That is why it still uses `useAnimatedGestureHandler` with the
  old `PanGestureHandler`, which is deprecated in Reanimated 3 but still works there.
  Only use APIs that exist on both sides.
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
