# Backlog

Known issues found by reading the code, not yet fixed. None has a failing test
yet; write one first when picking an item up (see
[unit-testing.md](unit-testing.md)). Line numbers are as of commit `c56ff00`.

## Before the next release

### Release the fixes made since 0.3.4

npm has 0.3.4. On top of it, `main` has these changes:

- The section list centers on the touched section when it opens, and stays
  open while a finger rests on the dots.
- The dots' thumb starts on the current section each time the bar shows.
- The hide and retry timers are cleared on unmount.
- The indicator keeps its thumb at the end while the list overscrolls.
- The indicator's thumb stays under a finger that lands while the list is
  still reporting its scroll.
- Neither component reads a shared value from JS on the scroll or drag path
  (on Reanimated 3 that read blocks the JS thread), and a drag on the dots
  crosses to JS only when the section changes.
- The section list's rows no longer log a Gesture Handler error on the New
  Architecture.

The production app still runs a patched 0.3.2. When it upgrades it should drop
the whole patch (see `CLAUDE.md`).

Before that release:

- Check on a device, with the example app (Reanimated 3), "The open section
  list jumps instead of gliding while the finger crosses dots" below. It
  cannot show under Jest.
- Decide whether "The indicator shows itself while the list overscrolls" below
  is wanted.
- Carried over from the 0.3.4 release, in case it was not done then: check on a
  device that the active tab of `FastScrollSectionTab` still follows the list
  as it scrolls. Production uses the tab bar display only, driven by
  `onViewableIndexChanged`, and the tab bar re-render change in 0.3.4 touches
  that path.

## Bugs

### The indicator shows itself while the list overscrolls

[FastScrollIndicator.tsx:283-287](../src/FastScrollIndicator/FastScrollIndicator.tsx#L283-L287):
offsets outside 0..1 used to return early. Now they are clamped, which was the
point (the thumb used to stop short of the end on a bounce), but they also call
`showFastScrollBar()`. On iOS:

- The bar shows while a list is pulled past its top, as in a pull-to-refresh.
- On a list shorter than its viewport, an app that floors the scrollable height
  at 1 px, as the production app does, reports a pull upwards as offsets far
  above 1. The thumb goes to the end of the track of a list that cannot scroll.

Android reports no offsets past the ends. `NaN` (0 / 0) still reaches
`translateY`, as before.

Possible fix: clamp the thumb, but show the bar only for offsets inside 0..1,
and drop `NaN`.

### The open section list jumps instead of gliding while the finger crosses dots

[FastScrollSectionFullList.tsx:221-226](../src/FastScrollSectionDots/FastScrollSectionFullList.tsx#L221-L226):
every `show()` centers through `centerPendingSection`, which scrolls with
`animated: false`. The touch that opens the list needs that: on Android, an
animated scroll started while the list lays out its rows does not move it. But
it also applies while the finger drags across dots with the list open and laid
out, where the list used to glide from row to row. The suite asserts the jump
(`scrolls the open section list to center the section under the finger, and
again a second later`). How it looks is not confirmed on a device.

Possible fix: animate when the list was already open and the row is laid out,
and keep the jump for the opening touch.

### The dots' thumb can sit below the last dot when the sections change while the bar shows

[FastScrollSectionDotsBar.tsx:115-119](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L115-L119):
`initialSectionIndex` only places the thumb when the bar mounts. When the app
passes fewer sections while the bar is visible, the thumb stays at its old y,
below the shorter strip, until the next `onViewableIndexChanged`. 0.3.4 behaves
the same; the fix for sections replaced while the bar is hidden does not cover
it.

Possible fix: when the sections change, move the thumb to the dot of the list
index the dots remember.

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

### Both components restart the hide timer on every scroll frame

Apps call `onScrollToOffsetPercentage` on every `onScroll` frame, on both
components:

- `FastScrollIndicator`
  ([line 287](../src/FastScrollIndicator/FastScrollIndicator.tsx#L287)) runs
  `showFastScrollBar()`, which calls `setVisible(true)` and clears and sets a
  `setTimeout`.
- `useHideFlatBar`, used by the dots
  ([utils.ts:110-119](../src/utils.ts#L110-L119)), skips the `setVisible` and
  the spring when the bar is already visible, but still calls
  `scheduleHideFastScrollbar()` first, so it also clears and sets a timer every
  frame.

Possible fix for both: one timer with a deadline. Each scroll only sets
`hideAt = now + timeout`. When the timer fires before `hideAt`, it re-arms for
the remaining time. The same applies to the section list's `onScroll`
([FastScrollSectionFullList.tsx:278-280](../src/FastScrollSectionDots/FastScrollSectionFullList.tsx#L278-L280)).

### The dots bar remounts every time it shows

[FastScrollSectionDots.tsx:257](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L257):
each show mounts the bar again: the `GestureDetector`, its worklets, one view
per dot, and a `measure` call. Meanwhile `useHideFlatBar` springs
`translateFastScrollBarX` ([utils.ts:76](../src/utils.ts#L76)) on every show and
hide, but nothing reads it.

Possible fix: keep the bar mounted and slide it with `translateFastScrollBarX`
(or drop that shared value). The thumb no longer depends on it: the dots keep
the last active section and the bar starts on it when it mounts.

### Unstable props rebuild styles and gestures

- The default `thumbSize` is an object literal in the parameter list
  ([FastScrollIndicator.tsx:95-99](../src/FastScrollIndicator/FastScrollIndicator.tsx#L95-L99)),
  so `styles` ([line 292](../src/FastScrollIndicator/FastScrollIndicator.tsx#L292))
  and `pointStyle` ([line 255](../src/FastScrollIndicator/FastScrollIndicator.tsx#L255))
  are rebuilt on every render. A production list wrapper re-renders on every
  scroll frame and passes a new `scrollToOffsetPercentage` each time, which
  defeats the `React.memo`, so there they are rebuilt on every frame. Hoist the
  default to a constant and depend on `width` / `height` / `borderRadius`.
- `onScrollToIndex` of the dots reaches `FastScrollSectionFullList` through
  `fastScrollFullListOnScrollToIndex`
  ([FastScrollSectionDots.tsx:229-240](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L229-L240)),
  so a new callback re-renders every row and rebuilds its `Gesture.Tap()`.

### Small ones

- The indicator's `pointStyle`
  ([FastScrollIndicator.tsx:255-269](../src/FastScrollIndicator/FastScrollIndicator.tsx#L255-L269))
  starts two new `withSpring` (translateX, scale) on every `translateY` change,
  that is every scroll frame, even when their target has not moved. Same for
  the scale in `FastScrollSectionDotsBar`'s `pointStyle`.
- `findNearestActiveSection` ([utils.ts:20-29](../src/utils.ts#L20-L29)) copies
  and reverses the sections on every call. The tab bar calls it on every
  viewability change. Sections are sorted by `index`, so a reverse loop or a
  binary search needs no allocation.
- `entering` / `exiting` animations are rebuilt on every render
  ([FastScrollIndicator.tsx:313-319](../src/FastScrollIndicator/FastScrollIndicator.tsx#L313-L319),
  [FastScrollSectionDots.tsx:166-172](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L166-L172)),
  and `FastScrollSectionFullListItem` calls `StyleSheet.create` per row and
  `isActive`. Cheap, but they can be module constants.

## Cleanup

- The dots' pan finds the section twice per section change: on the UI thread,
  to report only a new section
  ([FastScrollSectionDotsBar.tsx:262-269](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L262-L269)),
  then again on JS from the y it sent
  ([lines 225-230](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L225-L230)).
  The two read different copies of the sections (the shared value is updated in
  an effect), so they can disagree for a frame after the sections change. Send
  `sectionIndex` through `runOnJS` and read `sectionsRef.current[sectionIndex]`.
- The `y` in the `sections` memo
  ([line 127](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L127))
  and `newTranslate + dotSize / 2` in `onFinalize`
  ([line 303](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L303))
  repeat the formula of `thumbYOnDot`.
- `leaves no hide timer running once it unmounts`
  ([utils.test.ts:146-156](../src/__tests__/utils.test.ts#L146-L156)) asserts
  `jest.getTimerCount()` and advances 16 ms to let a Reanimated frame pass.
  [unit-testing.md](unit-testing.md) says a hook test never asserts on timer
  handles; a timer count is close to that, and it ties the test to Reanimated's
  own timers. `useTimer`'s `never times out once unmounted` asserts on the
  callback instead, but `useHideFlatBar` has no callback to observe after it
  unmounts.
- The example's `IndicatorCost` screen
  ([IndicatorCost.tsx:81-107](../example/src/indicatorCost/IndicatorCost.tsx#L81-L107))
  maps the thumb to an offset over `ROWS.length * ROW_HEIGHT`, but the offset
  back to the thumb over `contentSize - layoutMeasurement`. The thumb moves
  under the finger on release and the end of the track maps past the end of the
  list, on the screen meant to measure the indicator. It also never removes
  `global.__indicatorCost`
  ([lines 136-142](../example/src/indicatorCost/IndicatorCost.tsx#L136-L142)).
- Two documented defaults of public props disagree with the code. The dots'
  `thumbColor` says `'rgba(255, 255, 255, 0.9)'`
  ([FastScrollSectionDots.tsx:55](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L55))
  and is `0.8`
  ([line 113](../src/FastScrollSectionDots/FastScrollSectionDots.tsx#L113)).
  The indicator's `thumbSize` says `15`
  ([FastScrollIndicator.tsx:39](../src/FastScrollIndicator/FastScrollIndicator.tsx#L39))
  and is `{ borderRadius: 7, height: 50, width: 7 }`
  ([lines 95-99](../src/FastScrollIndicator/FastScrollIndicator.tsx#L95-L99)).

## Proposals

### Center the section list without a virtualized list

[FastScrollSectionFullList.tsx:132-216](../src/FastScrollSectionDots/FastScrollSectionFullList.tsx#L132-L216)
centers a row through four mechanisms: `onContentSizeChange`, a 50 ms poll
while no row is measured, a jump to an estimated offset, and a retry after 1 s.
`centerMiss` ties them together, and only works because `FlatList` calls
`onScrollToIndexFailed` synchronously inside `scrollToIndex`. All of it works
around virtualization, for a list of one short row per section, and the state
it keeps once let the list center a section the app had removed.

A `ScrollView` that records each row's y from `onLayout` can center with one
exact `scrollTo` once the row is laid out. That drops `sectionToCenter`,
`centerMiss`, `centerRetryTimeout`, `listHeight` and `onScrollToIndexFailed`.
Every row then mounts when the list opens, so measure it with a few hundred
sections first.

### Asymmetric hitSlop on the dots bar

[FastScrollSectionDotsBar.tsx:30](../src/FastScrollSectionDots/FastScrollSectionDotsBar.tsx#L30)
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
