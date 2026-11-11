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

- **`yarn typecheck`** runs `tsc --noEmit` twice. The first pass uses the root
  `tsconfig.json`, which only excludes `example/`, so every `*.test.ts(x)` is
  type-checked, against the dev dependencies. Jest globals (`describe`, `it`,
  `expect`, `jest`) are typed by `@types/jest`. The second pass (`-p example`)
  checks the example app and the `src/` files it imports against the example's
  peers (Reanimated 3); it does not reach the test files.
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
| `jest.config.js` | `@testing-library/react-native` preset (see below), `clearMocks: true`, and `transformIgnorePatterns` that let Babel compile `react-native-reanimated`, `react-native-gesture-handler`, `react-native-redash` and `@shopify/flash-list`. |
| `babel.config.js` | Adds `react-native-reanimated/plugin` in the `test` env only (see [Reanimated runs for real](#reanimated-runs-for-real)). The published `lib/` build does not use it. |
| `jest/environment.js` | Node test environment that makes `global.performance` writable. RN 0.70's `jest/setup.js` assigns it, which throws on Node >= 18. Without this file the whole suite fails on Node 18 and newer, which CI also runs (`.nvmrc`). |
| `jest/setup.js` | Runs before the framework: loads `react-native-gesture-handler/jestSetup`, mocks `NativeAnimatedHelper`, and defines `global.ReanimatedDataMock` (see below). |
| `jest/setupAfterEnv.js` | Runs after the framework: loads the `setimmediate` polyfill Reanimated needs, registers the RNTL matchers (`@testing-library/react-native/extend-expect`), and adds the global `afterEach` that ends fake timers (see [Determinism](#determinism)). |
| `jest/matchers.d.ts` | Makes the RNTL matcher types visible to `yarn typecheck`; the runtime registration above is invisible to `tsc`. |

**Why RNTL's preset and not `react-native`'s.** RN 0.70's Jest setup replaces
`global.Promise` with a polyfill that resolves through `setImmediate`. Under
`jest.useFakeTimers()` that polyfill never resolves, so every `await
user.press(...)` hangs until the test times out. The
`@testing-library/react-native` preset is the `react-native` preset plus a step
that restores the native `Promise`. Keep it until RN is upgraded to 0.71+.

### Reanimated runs for real

`react-native-reanimated` is **not** mocked. Under Jest it switches to its JS
implementation, so shared values, `useAnimatedStyle`, `withSpring`, `runOnJS`
and the `entering`/`exiting` layout animations all execute. `runOnJS(fn)` calls
`fn` synchronously there.

Its frame clock reads `global.ReanimatedDataMock.now()`, which `jest/setup.js`
backs with `Date.now()`. Consequence: animations follow Jest's clock - with fake
timers enabled, `jest.advanceTimersByTime` advances them too. Animated styles
are applied on the next frame, so a test must advance the clock before reading
one.

Apps compile this library's `src/` with Reanimated's Babel plugin, which records
the shared values each worklet reads. `babel.config.js` enables the plugin for
tests so they match: without it, an animated style is computed on its first
frame and never again.

Do **not** call Reanimated's `setUpTests()` helper: in 2.12 it calls
`require('expect').extend`, which does not exist on Jest >= 28, so the
`toHaveAnimatedStyle` matcher is not available. Two animated values carry
meaning for the user, and `src/__fixtures__/positions.ts` reads both:

- `getThumbPosition()` - where a scroll bar's thumb sits. Advances one frame
  and returns the thumb's live `translateY`.
- `getDotsScrollOffset()` - how far the dots bar has scrolled its own strip of
  dots. Lets the spring settle (1 s) and returns the strip's `translateY`.

```tsx
act(() => ref.current?.onViewableIndexChanged(7));

expect(getThumbPosition()).toBe(39); // the middle of the second dot
```

Everything else animated (scale, slide-in) is decoration: assert on what is
rendered and which callbacks fired.

### Gestures

`react-native-gesture-handler` is set up with its official `jestSetup`. Every
gesture in the library uses the `Gesture` API in a `GestureDetector`. The pans
of `FastScrollIndicator` and `FastScrollSectionDotsBar` are driven step by step
through the helpers in `src/__fixtures__/gestures.ts`:

```tsx
import { layoutPanArea, touchDown } from '../../__fixtures__/gestures';

render(<FastScrollIndicator thumbSize={THUMB} scrollToOffsetPercentage={onScroll} />);
layoutPanArea(550);

const finger = touchDown(25); // onBegin
expect(onScroll).toHaveBeenLastCalledWith(0);
finger.moveTo(275); // onStart, then onUpdate on later moves
expect(onScroll).toHaveBeenLastCalledWith(0.5);
finger.lift(); // onFinalize
```

- **A finger, step by step.** `touchDown(y)` returns a finger you can
  `moveTo(y)`, hold (just stop calling it - the gesture stays active) and
  `lift()`. Lifting a finger that never moved fails the pan, as a tap does on a
  device. `drag([y, ...])` is the whole gesture in one call: touch down, move
  through the rest, lift.
- **Finding the pan.** The area the finger drags has a `testID` ending in
  `-track` (`fast-scroll-indicator-track`, `fast-scroll-section-dots-track`),
  and its pan gesture has the same test ID. `getPanArea()` finds the view, and
  `getByGestureTestId` from RNGH's jest utils finds the gesture. These views
  render no text and have no role, so the test ID is the only handle on them.
- **Why not `fireGestureHandler`.** RNGH's `fireGestureHandler` sends a whole
  gesture at once (it fills in `BEGAN`, `ACTIVE` and `END`), so a test could
  not hold a finger down between steps. The helpers send one event at a time
  on the same channel it uses for `Gesture` API gestures, with the `handlerTag`
  of the gesture: a state change carries `oldState`, a move while active does
  not. RNGH then calls `onBegin` / `onStart` / `onUpdate` / `onFinalize` as it
  does on a device.
- **Re-renders reach the pan on the next tick.** When a re-render hands
  `GestureDetector` a rebuilt gesture, it applies the new callbacks in a
  `setImmediate`, which fake timers hold back. Every pan event the helpers send
  first advances the clock by 0 ms to let it through, as the next tick always
  passes on a device before a touch.
- **The pan must not be rebuilt per render.** `getPanCallbacks()` returns the
  pan's callbacks as `GestureDetector` last applied them. On a device they are
  the worklets Reanimated receives, and it holds the JS functions they call from
  native code, so a pan rebuilt on every render keeps every render of the app
  alive. A test that re-renders with new props asserts the callbacks stay the
  same object. This is the one place a test checks object identity: the leak it
  guards against cannot be measured under Jest.
- **Lay out first.** Gesture coordinates are relative to a laid-out view. Call
  `layoutPanArea(height)` before dragging when the component computes positions
  from its own size (`FastScrollIndicator`), otherwise every percentage is
  computed against a height of 0.

The rows of the dots' section list (`FastScrollSectionFullListItem`) use a
`Gesture.Tap()`, a gesture that only matters as a whole, so drive them with
`fireGestureHandler` and the gesture's test ID
(`fast-scroll-section-list-row-<sectionIndex>`), not `userEvent.press` - the
row has no press handler for it to find:

```tsx
import { State, TapGesture } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

const rowTap = getByGestureTestId('fast-scroll-section-list-row-2');
act(() =>
  fireGestureHandler<TapGesture>(rowTap, [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { state: State.END }, // a tap: the row scrolls the list
  ])
);
act(() =>
  fireGestureHandler<TapGesture>(rowTap, [
    { state: State.BEGAN },
    { state: State.FAILED }, // the finger moved: not a tap
  ])
);
```

### Mocks the RN preset already provides

The `react-native` preset mocks native components. Two things that matter here:

- `ScrollView`'s instance methods (`scrollTo`, `scrollToEnd`, ...) are single
  `jest.fn()`s **shared by every `ScrollView` in every test**. `clearMocks`
  resets their calls between tests; within one test, assert relative to what
  the test itself did (`toHaveBeenCalledTimes` after the test's own actions).
  Reach the ScrollView with `screen.UNSAFE_getByType(ScrollView)` - the one
  documented `UNSAFE_*` exception - for its `instance.scrollTo` or
  to fire `layout` on it. The tab bar and the dots' section list are the only
  ScrollViews in their components.
- Nothing is ever laid out: every `onLayout` is silent until a test fires a
  `layout` event, and `FlatList` renders only its initial batch. When a
  behavior depends on sizes (centering the active tab, centering the active row
  of the section list), lay the component out in the test, as
  `layoutTabBar` and `layoutSectionList` do in the component suites. A
  `layout` event fired on a label bubbles to the nearest view that measures
  itself (a tab, a list row).
- `View`'s native methods are mocked the same way: `measure` is one `jest.fn()`
  on `View.prototype` that never calls back. The dots bar reads its height with
  it, so `layoutDotsBar` in the dots suite makes it answer once
  (`mockImplementationOnce`), fires `layout`, and resets it - an implementation
  left behind would answer some later, unrelated layout.

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
- Node: CI uses `.nvmrc` (22.x). The example app (React Native 0.76) does not
  install on Node below 18, and CI installs it for `yarn typecheck`. The tests
  run on Node 18+ because of `jest/environment.js`.
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
  the tool for events `userEvent` does not model: `layout` and scroll events.
  Gesture-handler gestures are neither: see *Gestures* below.
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
- `UNSAFE_*` queries are banned except in the helper described under
  [Mocks the RN preset already provides](#mocks-the-rn-preset-already-provides)
  (`ScrollView` instance).
- When a component renders no text at all (the dots bar, the indicator thumb),
  assert on the observable consequence - a callback fired, a sibling label
  appeared, the tree is empty, the thumb moved (`getThumbPosition()`) - rather
  than on component types or style objects.

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
  `jest.useFakeTimers()` in `beforeEach`; the global `afterEach` in
  `jest/setupAfterEnv.js` turns them off. Anything involving
  `hideFastScrollIndicatorTimeout`, the full list's 3 s auto-hide,
  `debounceOnScrollToIndexDelay`, or the thumb's position needs them.
- That global hook first runs every pending timer, then restores real timers.
  Reanimated requests one frame at a time and waits for it; a frame still
  pending when the timers are swapped is lost, and every animated style freezes
  for the rest of the file. A suite's own `afterEach` runs *before* the global
  one, so leave restoring real timers to the global hook.
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

- `toHaveAnimatedStyle` is unavailable (Reanimated 2.12 + Jest 28
  incompatibility). `positions.ts` reads the thumb and the dots strip; the
  thumb's scale on press is not read.
- The scroll bars, the dots and the thumb render no text and expose no
  accessibility role or label, so tests cannot query them the way a user (or a
  screen reader) would perceive them. `getThumbPosition()` finds the thumb as
  the only absolutely positioned view in the pan area (`getPanArea()`). Adding accessibility
  props to the library would fix both the tests and real accessibility.
- No layout engine: positions that depend on `onLayout` / `measure` only exist
  when the test provides them (see [Mocks the RN preset already
  provides](#mocks-the-rn-preset-already-provides)).
- The gesture helpers reproduce how RNGH 2.8 routes `Gesture` API events, read
  from its source. Under Jest RNGH calls the callbacks on the JS thread; on a
  device they run as worklets on the UI thread, with the same state logic.
