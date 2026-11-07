# Unit Testing Rules

Rules for writing unit and integration tests in this repo (Jest +
`@testing-library/react-native`). This document owns how the tests are written
and how the test environment is wired.

These rules combine this library's setup with Kent C. Dodds' testing principles
([Testing Implementation
Details](https://kentcdodds.com/blog/testing-implementation-details), [Write
tests. Not too many. Mostly
integration.](https://kentcdodds.com/blog/write-tests),
[TestingJavaScript.com](https://www.testingjavascript.com/)).

## Guiding principle

> "The more your tests resemble the way your software is used, the more
> confidence they can give you." - Kent C. Dodds

A test earns its place by catching real regressions while surviving refactors.
This library has exactly two users:

- **The developer** who installs it: passes props
  (`stickyHeaderIndicesWithData`, `hideFastScrollIndicatorTimeout`, ...),
  receives callbacks (`onScrollToIndex`, `scrollToOffsetPercentage`) and calls
  the imperative handle through a ref (`onViewableIndexChanged`,
  `onScrollToOffsetPercentage`).
- **The end user** of the app: sees the scroll bar, tabs and section list, taps
  a tab, drags the thumb.

Test through those two interfaces only. A test that reaches into internals
(shared values, `useRef` contents, private helpers, the order of internal
`setState` calls) creates a third "Test User" and fails in both directions:

- **False negative:** you rename `translateFastScrollBarXTimer` or swap a
  `useState` for a shared value, behavior is identical, the test breaks.
  Refactoring gets punished.
- **False positive:** the `onPress` that calls `onScrollToIndex` is deleted, but
  the test calls an internal helper directly and still passes. The broken
  feature ships.

So: assert on return values, rendered output, and calls to the callbacks the
developer passed in - with the arguments the developer would observe.

## Choosing what kind of test to write

Prefer the lowest level that gives real confidence (Testing Trophy: static ->
unit -> integration -> e2e). Work down this ladder.

### 1. Pure function - first choice

The math of this library (which section an index belongs to, where the thumb
sits, how far the tab bar scrolls) lives in plain functions: `src/utils.ts`,
`src/FastScrollSectionDots/utils.ts`, `src/FastScrollSectionTab/utils.ts`. If
new logic is buried inside a component, extract it next to these and test the
extracted function.

Functions marked `'worklet'` are still plain JavaScript under Jest - call them
directly, no Reanimated setup needed:

```ts
import { calculateYPosition } from '../utils';

describe('calculateYPosition', () => {
  it('clamps a drag below the last dot to the bottom of the bar', () => {
    const result = calculateYPosition({
      y: 500,
      sections: threeSections(),
      dotSize: 10,
      dotMargin: 12,
    });

    expect(result).toEqual({ yPosition: 56, yPercentage: 1 });
  });
});
```

### 2. Hook - `renderHook`

Hooks that own timing or measurement (`useHideFlatBar`, `useTimer`,
`useComponentSize`) are tested with `renderHook`. Assert on `result.current`
and on the callbacks you passed in - never on refs or timer handles:

```ts
const { result } = renderHook(() =>
  useHideFlatBar({ barWidth: 100, hideFastScrollIndicatorTimeout: 1000 })
);

act(() => result.current.showFastScrollBar());
act(() => jest.advanceTimersByTime(1000));

expect(result.current.visible).toBe(false);
```

### 3. Component - through props, ref and screen

This is the rung that proves the library works. Render the exported component
the way an app would, drive it through its public surface, and assert on what
the user sees and on the callbacks the developer receives:

```tsx
it('activates the section that contains the first visible item', () => {
  // The handle type is not exported; derive it from the component.
  const ref = React.createRef<React.ElementRef<typeof FastScrollSectionTab>>();
  render(
    <FastScrollSectionTab
      ref={ref}
      stickyHeaderIndicesWithData={sections}
      onScrollToIndex={jest.fn()}
    />
  );

  act(() => ref.current?.onViewableIndexChanged(7));

  expect(screen.getByText('Vegetables (active)')).toBeOnTheScreen();
});
```

Calling the imperative handle **is** the developer interface - it is exactly
what an app does from `onViewableItemsChanged` / `onScroll` - so it is not an
implementation detail. Wrap it in `act`, because it is called outside React's
event system.

Prefer testing the exported component (`FastScrollIndicator`,
`FastScrollSectionDots`, `FastScrollSectionTab`) over its internal children
(`FastScrollSectionDotsBar`, `FastScrollSectionFullList`, ...). Test an internal
child directly only when reaching its behavior through the parent would need an
unreasonable amount of setup.

### Static layer

TypeScript is the static layer of the trophy: skip tests for things the
type-checker already proves (e.g. "does not crash without `onScrollToIndex`"
for a required prop).

Unlike many app repos, **test files are covered by both static gates here**:

- **`yarn typecheck`** (`tsc --noEmit`) uses the root `tsconfig.json`, which
  only excludes `example/`, so every `*.test.ts(x)` is type-checked. Jest
  globals (`describe`, `it`, `expect`, `jest`) are typed by `@types/jest`.
- **`yarn lint`** lints `**/*.{js,ts,tsx}`, which includes test files and the
  `jest/` setup directory.

Both run in CI (`.github/workflows/ci.yml`), so a type or lint error in a test
fails the build.

Coverage is a byproduct, never the goal. CI collects it (`--coverage`) but
enforces no threshold. Returns diminish sharply past ~70%; chasing 100% forces
tests of implementation details. Ask "which behaviors would hurt users if they
silently broke?" and cover those. For this library that means, at minimum:

- the item index -> section mapping (`findNearestActiveSection`,
  `createFullSectionData`);
- show/hide timing of the scroll bars, including the `timeout === 0` "always
  visible" mode and the lock while the full list is open;
- the indices passed to `onScrollToIndex` (header `index` from the dots and tabs,
  first item `startIndex` from the full list) and the debounce on the dots;
- the offset percentage passed to `scrollToOffsetPercentage` while dragging;
- the tab bar scroll amount (`getScrollAmount`) at both edges.

## Test environment

The wiring lives in `jest.config.js` and `jest/`. Read this before adding a
mock: most of what a test needs is already there.

| File | What it does |
| --- | --- |
| `jest.config.js` | `react-native` preset, `clearMocks: true`, and `transformIgnorePatterns` that let Babel compile `react-native-reanimated`, `react-native-gesture-handler`, `react-native-redash` and `@shopify/flash-list`. |
| `jest/environment.js` | Node test environment that makes `global.performance` writable. RN 0.70's `jest/setup.js` assigns it, which throws on Node >= 18. Without this file the whole suite fails on a modern local Node, even though CI (Node 16 via `.nvmrc`) passes. |
| `jest/setup.js` | Runs before the framework: loads `react-native-gesture-handler/jestSetup`, mocks `NativeAnimatedHelper`, and defines `global.ReanimatedDataMock` (see below). |
| `jest/setupAfterEnv.js` | Runs after the framework: loads the `setimmediate` polyfill Reanimated needs and registers the RNTL matchers (`@testing-library/react-native/extend-expect`). |

### Reanimated runs for real

`react-native-reanimated` is **not** mocked. Under Jest it switches to its JS
implementation, so shared values, `useAnimatedStyle`, `withSpring`, `runOnJS`
and the `entering`/`exiting` layout animations all execute. `runOnJS(fn)` calls
`fn` synchronously there.

Its frame clock reads `global.ReanimatedDataMock.now()`, which `jest/setup.js`
backs with `Date.now()`. Consequence: animations follow Jest's clock - with fake
timers enabled, `jest.advanceTimersByTime` advances them too.

Do **not** call Reanimated's `setUpTests()` helper: in 2.12 it calls
`require('expect').extend`, which does not exist on Jest >= 28, so the
`toHaveAnimatedStyle` matcher is not available. Assert on the user-visible
outcome (what is rendered, which callback fired) instead of on animated style
values.

### Gestures

`react-native-gesture-handler` is set up with its official `jestSetup`. Drags
on the old-API `PanGestureHandler` used by `FastScrollIndicator` and
`FastScrollSectionDotsBar` are driven with `fireGestureHandler` from
`react-native-gesture-handler/jest-utils`. Under Jest each handler's child
receives a `handlerType` prop, which is how a test finds it (the components
expose no `testID` for it):

```tsx
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';

const getPanHandler = () =>
  screen.UNSAFE_getAllByProps({ handlerType: 'PanGestureHandler' })[0]!;

act(() =>
  fireGestureHandler(getPanHandler(), [
    { state: State.BEGAN, y: 25 },
    { state: State.ACTIVE, y: 275 },
    { state: State.END, y: 275 },
  ])
);

expect(scrollToOffsetPercentage).toHaveBeenLastCalledWith(0.5);
```

`UNSAFE_*` queries are banned everywhere else; this helper is the one exception,
and it must live in a single named function so it is easy to replace.

Gesture coordinates are relative to a laid-out view. Fire a `layout` event on
the view with the size the test assumes before dragging, otherwise every
percentage is computed against a height of 0.

### Mocks the RN preset already provides

The `react-native` preset mocks native components. Two things that matter here:

- `ScrollView`'s instance methods (`scrollTo`, `scrollToEnd`, ...) are single
  `jest.fn()`s **shared by every `ScrollView` in every test**. `clearMocks`
  resets their calls between tests; within one test, assert relative to what
  the test itself did (`toHaveBeenCalledTimes` after the test's own actions).
  Reach it with `screen.UNSAFE_getByType(ScrollView).instance.scrollTo` - the
  same documented exception as the gesture helper.
- Nothing is ever laid out: every `onLayout` is silent until a test fires a
  `layout` event, and `FlatList` renders only its initial batch.

## Placement, naming, running

- Co-locate tests with the code in a `__tests__/` directory next to the source:
  `src/FastScrollSectionTab/__tests__/FastScrollSectionTab.test.tsx`.
- **Nothing but suites goes under `__tests__/`.** Jest's default `testMatch`
  collects every `.js/.ts/.tsx` file in that directory, so a helper module there
  fails the run as an empty suite.
- Put shared test helpers in a sibling **`__fixtures__/`** directory. Do not put
  them beside the source as `thing.testUtils.ts`: `src/` is published to npm
  (`"files"` in `package.json`), and only `__tests__`, `__fixtures__` and
  `__mocks__` are excluded from the package.
- Run: `yarn test <path/to/thing.test.tsx>` for one file, `yarn test` for
  everything, `yarn test --coverage` for the report. `yarn typecheck` and
  `yarn lint` for the static gates.
- Node: CI uses `.nvmrc` (16.x). Newer local Node versions work because of
  `jest/environment.js`.
- `react-test-renderer` must be **exactly** the installed `react` version
  (`18.1.0`) - `@testing-library/react-native` compares the two and throws
  otherwise. Bump them together.

## Structure

- One `describe` per unit under test; keep nesting to that single level. A file
  that tests several functions from one module has one `describe` per function.
- Test names are behavior sentences that complete "it ...":
  `it('hides the scroll bar after the timeout once the list stops scrolling')`.
  Name the behavior, never the method ("works", "handles X correctly" are
  banned - say what happens).
- Arrange-Act-Assert with a single Arrange per test. Multiple Act/Assert steps
  are fine when they follow one workflow (show -> wait -> hidden) - prefer one
  longer test that models a complete flow over several fragmentary tests sharing
  state.
- Keep setup inline in each test so every test reads standalone. When setup
  genuinely repeats, extract a **setup/factory function that returns what tests
  need** - never shared mutable variables assigned in `beforeEach`:

  ```tsx
  const renderTab = (onScrollToIndex = jest.fn()) => {
    const ref = React.createRef<React.ElementRef<typeof FastScrollSectionTab>>();
    render(
      <FastScrollSectionTab
        ref={ref}
        stickyHeaderIndicesWithData={sections}
        onScrollToIndex={onScrollToIndex}
      />
    );
    return { ref, onScrollToIndex };
  };
  ```

  Accept some duplication until a pattern is clear ("prefer duplication over
  the wrong abstraction").

- `clearMocks: true` is set globally in `jest.config.js`, so **do not add
  `jest.clearAllMocks()` to `beforeEach`**. Reserve lifecycle hooks for real
  infrastructure: fake timers and tearing them down.
- Use `it.each` for tables of inputs to a pure function (index -> section, y ->
  percentage); keep the row values readable and add a comment with the formula
  when the expected value is computed.
- Use `it.todo('...')` to sketch a spec before implementing the tests.
- A test documenting behavior that is wrong but currently relied upon is a
  **characterization test**: say so in a comment, with the issue or reason, so
  nobody reads the assertion as the desired outcome. Example: sections built
  from plain `stickyHeaderIndices` all get the placeholder text `'1'`.

## Queries and interactions

`@testing-library/react-native` is on **12.x** (12.9). The matchers are
registered in `jest/setupAfterEnv.js` - no import needed in the test, and no
`@testing-library/jest-native`.

- Query by what the user perceives, in this order: `getByRole` (with the `name`
  option) > `getByLabelText` (accessibility label) > `getByPlaceholderText` >
  `getByText` > `getByDisplayValue`. `getByTestId` is a last resort only. In
  this library most targets are section labels, so `getByText` is the usual
  query.
- Query via the `screen` object instead of destructuring `render`'s result.
- Prefer `userEvent` over `fireEvent` for presses and typing - it fires the
  realistic sequence of events a real user triggers. `userEvent.setup()` returns
  the instance; its methods are async, so `await` every one. `fireEvent` remains
  the tool for events `userEvent` does not model: `layout`, scroll events, and
  `pressIn` on its own (`FastScrollSectionFullListItem` reacts to `onPressIn`).
- To wait for something to appear, use `await screen.findByText(...)` (a `find*`
  query), never `waitFor` + `getBy*`.
- `waitFor` rules: assertions only inside the callback (it may run many times),
  one assertion per callback, side effects outside it, never an empty callback.
- Use `query*` variants only to assert absence:
  `expect(screen.queryByText('Dairy')).not.toBeOnTheScreen()`. Everywhere else
  use `get*`/`find*` so failures produce useful errors.
- Use the built-in matchers (`toBeOnTheScreen`, `toBeVisible`,
  `toHaveTextContent`, `toHaveStyle`, ...) for clear failure messages.
- `render`, `fireEvent` and `userEvent` are already wrapped in `act`. Calls to an
  imperative handle and `jest.advanceTimersByTime` are not - wrap those in
  `act`. Any other `act` warning signals a real async bug to fix, not something
  to wrap and silence.
- `UNSAFE_*` queries are banned except in the two helpers described under
  [Test environment](#test-environment) (gesture handler, `ScrollView` instance).
- When a component renders no text at all (the dots bar, the indicator thumb),
  assert on the observable consequence - a callback fired, a sibling label
  appeared, the tree is empty - rather than on component types or style objects.

Version note: RNTL 13 requires React >= 18.2 and RN >= 0.71, so it is out until
the dev dependencies move off React 18.1.0 / RN 0.70.6. Examples online written
for v13 (matchers auto-registered on import) or for v9-v11 (destructured
queries, `@testing-library/jest-native`) do not match this setup.

## Mocking

- Mock as little as possible - every mock removes confidence in the integration
  between the code under test and the thing mocked. Mock only what cannot run
  for real in a test: native modules and the RN internals the preset already
  covers.
- Reanimated, gesture-handler, redash and `throttle-debounce` run for real.
  Never mock them to make a test pass; if one fails to load, fix the global
  setup in `jest/` instead of the test.
- Mock at module boundaries with `jest.mock('module')` at the top of the file.
  Type mock access with `jest.mocked(fn)`; build partial expectations with
  `expect.objectContaining` rather than exhaustive literals.
- Never mock the module under test or its sibling helpers just to isolate "the
  unit" (e.g. mocking `../utils` inside a component test) - run the real thing.
  Shallow isolation hides integration breaks.
- Build `Section` / `SectionFullData` fixtures with a typed factory function, not
  with `as any` / `as unknown as`. A cast hides a typo in the fields the test
  did write and answers `undefined` for the ones it did not.

## Determinism

- **Fake timers are not enabled globally.** A suite that needs them calls
  `jest.useFakeTimers()` in `beforeEach` and `jest.useRealTimers()` in
  `afterEach`. Anything involving `hideFastScrollIndicatorTimeout`, the full
  list's 3 s auto-hide, or `debounceOnScrollToIndexDelay` needs them.
- Advance explicitly and inside `act`:
  `act(() => jest.advanceTimersByTime(ms))`. Jest 28 has no
  `advanceTimersByTimeAsync`.
- Test timing at the boundary: one millisecond before the timeout still visible,
  at the timeout hidden. That is what catches an off-by-one or a timer that
  is not restarted.
- Because Reanimated's clock is `Date.now()`, fake timers also freeze and advance
  animations. Do not mix real timers with assertions that depend on an
  animation having finished.
- No real network, no randomness, no dependence on machine locale or timezone.

## Definition of done

A test task is complete only when:

1. `yarn test <path/to/changed.test.tsx>` passes.
2. `yarn typecheck` passes - test files are type-checked.
3. `yarn lint` passes - test files are linted.

Plus one judgment check: each new test fails if its behavior is broken (when in
doubt, break the code briefly and watch it fail) and would survive a rename of
internals.

## Known gaps

Open items in the testing setup, so a test is not written around them by
accident:

- Driving the old-API `PanGestureHandler` through `fireGestureHandler` +
  `useAnimatedGestureHandler` under Reanimated's JS implementation is not yet
  proven by a passing suite in this repo. The first gesture test confirms it;
  update [Gestures](#gestures) with what it finds.
- `toHaveAnimatedStyle` is unavailable (Reanimated 2.12 + Jest 28
  incompatibility), so animated styles such as the thumb's `translateY` cannot
  be asserted directly.
- The scroll bars, the dots and the thumb render no text and expose no
  accessibility role or label, so tests cannot query them the way a user (or a
  screen reader) would perceive them. Adding accessibility props to the library
  would fix both the tests and real accessibility.
- No layout engine: positions that depend on `onLayout` / `measure` only exist
  when the test fires the event itself.
