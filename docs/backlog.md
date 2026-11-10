# Backlog

Known issues found by reading the code, not yet fixed. None has a failing test
yet; write one first when picking an item up (see
[unit-testing.md](unit-testing.md)). Line numbers are as of commit `4f89236`.

## Before the next release

### Release the fixes made since 0.3.3

npm has 0.3.3, which predates the fixes for the stale `onScrollToIndex` after a
drag on the dots, the drag area of the dots bar, the tab bar re-renders, the
section label types, and the pan gestures that kept every render of the app's
screen in memory (rebuilt on each render, they handed Reanimated new JS
functions to hold from native code). The production app still runs a patched 0.3.2. When it
upgrades it should drop the whole patch (see `CLAUDE.md`).

Before that release, check on a device that the active tab of
`FastScrollSectionTab` still follows the list as it scrolls: production uses the
tab bar display only, driven by `onViewableIndexChanged`, and the tab bar
re-render change touches that path.

## Bugs

### The section list may not center the active section when it opens

[FastScrollSectionFullList.tsx:103-125](../src/FastScrollSectionDots/FastScrollSectionFullList.tsx#L103-L125):
`show()` only scrolls when `flatListRef.current` is set, but the list renders
`null` while hidden. On the first `show()` the list is not mounted yet, so
neither the `scrollToIndex` nor the 1 s retry runs. During a drag the next calls
fix it; a quick tap on the dots may leave the list at its top. Not confirmed on
a device yet.

Possible fix: scroll once the list has mounted (for example `initialScrollIndex`
or an effect on the active section), instead of in `show()`.

### `FastScrollIndicator` drops offsets outside 0..1 instead of clamping them

[FastScrollIndicator.tsx:243](../src/FastScrollIndicator/FastScrollIndicator.tsx#L243):
`onScrollToOffsetPercentage` returns early for values below 0 or above 1. On an
iOS bounce the list reports those values, so the thumb stays where it was
instead of reaching the top or the bottom. Clamp to 0..1 instead.

### Sections built from `stickyHeaderIndices` all read "1"

[utils.ts:232](../src/utils.ts#L232): `createFullSectionData` gives each section
`text: '1'` when only `stickyHeaderIndices` is passed, so the section list shows
"1" on every row. A label such as the section's position (`String(index + 1)`)
or an empty string would be better. Whatever changes, `createFullSectionData`
must keep spreading unknown fields of `stickyHeaderIndicesWithData` through.

## Reanimated 3 / New Architecture

Found by running the example app on Expo SDK 52 (Reanimated 3.16, Gesture
Handler 2.20, New Architecture), closer to production than the dev
dependencies.

### A drag on the dots sometimes scrolls the list instead

Not confirmed. On the Android emulator, two of six drags on the dots bar,
right after scrolling the list, scrolled the list and did not open the section
list; the other four worked. Check it again before treating it as a bug.

## Performance

None of these grows memory over time: they cost CPU and short-lived garbage.

### The dots bar reads shared values synchronously on viewability changes

[FastScrollSectionDotsBar.tsx:266-271](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L266-L271):
the bar's `onSectionChange` handle, reached from `onViewableIndexChanged`, reads
`enableExternalScrollEvents.value` and `containerScrollY.value` on the JS
thread. On Reanimated 3 (native), reading `.value` from JS goes through
`executeOnUIRuntimeSync` (`react-native-reanimated` `src/mutables.ts`), which
takes the UI runtime's lock and runs the read on the JS thread: the JS thread
waits while the UI thread runs worklets. On the example's IndicatorCost screen,
two such reads during a scroll took 0.44-0.79 ms at the median and 12-17 ms at
p95 (Android emulator, production bundle). On Reanimated 2.12, which this repo
develops against, the read is cheap, so tests do not show it.

It runs on viewability changes, not on every frame, so it costs far less than
the same reads did in `FastScrollIndicator`, which now keeps JS copies (the
track height from `onLayout`, a finger-on-track flag set with `runOnJS` from
the pan's `onBegin` / `onFinalize`). The same approach applies here.

### Dragging the dots does work on every frame, even without a section change

[FastScrollSectionDotsBar.tsx:189-201](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L189-L201):
every pan update calls `runOnJS(onThumbPositionChange)`. On the JS thread that
maps and searches the sections, then calls `onSectionChange`
([FastScrollSectionDots.tsx:195-206](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L195-L206)).
That call restarts the debounce, calls `lockScrollBarVisibility(true)`, and
calls `show()`
([FastScrollSectionFullList.tsx:103-124](../src/FastScrollSectionDots/FastScrollSectionFullList.tsx#L103-L124)),
which:

- starts an animated `scrollToIndex` on the section list;
- resets the 1 s rescroll timer and the 3 s hide timer.

That is about four `clearTimeout` / `setTimeout` pairs and a restarted scroll
animation per frame, even while the finger stays on one section.

Possible fix: find the section in the worklet (`findSectionOnPosition` already
is one), keep the last `sectionIndex` in a shared value, and only cross to JS
when it changes. The finger already holds the list open from `onBegin` to
`onFinalize`, so `show()` would not need to touch its hide timer at all.

### Both components restart the hide timer on every scroll frame

Apps call `onScrollToOffsetPercentage` on every `onScroll` frame, on both
components:

- `FastScrollIndicator`
  ([line 258](../src/FastScrollIndicator/FastScrollIndicator.tsx#L258)) runs
  `showFastScrollBar()`, which calls `setVisible(true)` and clears and sets a
  `setTimeout`.
- `useHideFlatBar`, used by the dots
  ([utils.ts:116-125](../src/utils.ts#L116-L125)), skips the `setVisible` and
  the spring when the bar is already visible, but still calls
  `scheduleHideFastScrollbar()` first, so it also clears and sets a timer every
  frame.

Possible fix for both: one timer with a deadline. Each scroll only sets
`hideAt = now + timeout`. When the timer fires before `hideAt`, it re-arms for
the remaining time. The same applies to the section list's `onScroll`
([FastScrollSectionFullList.tsx:158-160](../src/FastScrollSectionDots/FastScrollSectionFullList.tsx#L158-L160)).

### The dots bar remounts every time it shows

[FastScrollSectionDots.tsx:230](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L230):
each show mounts the bar again: the `GestureDetector`, its worklets, one view
per dot, and a `measure` call. Meanwhile `useHideFlatBar` springs
`translateFastScrollBarX` ([utils.ts:82](../src/utils.ts#L82)) on every show and
hide, but nothing reads it.

Possible fix: keep the bar mounted and slide it with `translateFastScrollBarX`
(or drop that shared value). The thumb no longer depends on it: the dots keep
the last active section and the bar starts on it when it mounts.

### Unstable props rebuild the gestures

- The indicator's `pan` depends on `scrollToOffsetPercentage`
  ([FastScrollIndicator.tsx:154-221](../src/FastScrollIndicator/FastScrollIndicator.tsx#L154-L221)).
  A production list wrapper passes an inline function and re-renders on every
  scroll frame, so the `React.memo` is defeated and the Pan gesture, with its
  worklets, is rebuilt and sent to the UI runtime on every frame. Read the
  callback through a ref, as the dots already do for `onScrollToIndex`.
- The default `thumbSize` is an object literal in the parameter list
  ([FastScrollIndicator.tsx:95-99](../src/FastScrollIndicator/FastScrollIndicator.tsx#L95-L99)),
  so `styles` ([line 281](../src/FastScrollIndicator/FastScrollIndicator.tsx#L281))
  and `pointStyle` are rebuilt on every render. Hoist the default to a constant
  and depend on `width` / `height` / `borderRadius`.
- `onScrollToIndex` of the dots reaches `FastScrollSectionFullList` through
  `fastScrollFullListOnScrollToIndex`
  ([FastScrollSectionDots.tsx:208-219](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L208-L219)),
  so a new callback re-renders every row and rebuilds its `Gesture.Tap()`.

### Small ones

- The indicator's `pointStyle`
  ([FastScrollIndicator.tsx:223-237](../src/FastScrollIndicator/FastScrollIndicator.tsx#L223-L237))
  starts two new `withSpring` (translateX, scale) on every `translateY` change,
  that is every scroll frame, even when their target has not moved. Same for
  the scale in `FastScrollSectionDotsBar`'s `pointStyle`.
- `findNearestActiveSection` ([utils.ts:24-33](../src/utils.ts#L24-L33)) copies
  and reverses the sections on every call. The tab bar calls it on every
  viewability change. Sections are sorted by `index`, so a reverse loop or a
  binary search needs no allocation.
- `entering` / `exiting` animations are rebuilt on every render
  ([FastScrollIndicator.tsx:284-290](../src/FastScrollIndicator/FastScrollIndicator.tsx#L284-L290),
  [FastScrollSectionDots.tsx:156-162](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L156-L162)),
  and `FastScrollSectionFullListItem` calls `StyleSheet.create` per row and
  `isActive`. Cheap, but they can be module constants.

## Proposals

### Asymmetric hitSlop on the dots bar

[FastScrollSectionDotsBar.tsx:25](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L25)
uses `{ horizontal: 20 }`. The bar always sits on the left of a row with the
section list to its right, whatever `side` is (`side` only picks the slide
animation), so `side` is not what the hitSlop should depend on:

- To the right, the bar has 5 px of padding and 10 px of `marginRight` before
  the section list or the list content. A 20 px slop takes about 5 px of the
  section list's rows: a tap there moves the thumb instead of picking the row.
- To the left there is nothing to take touches from.

Suggested: `{ left: 20, right: 15 }`. It changes the touch area, so check it on
a device first, including that gesture-handler's hitSlop works outside the
parent's bounds on Android.
