# Backlog

Known issues found by reading the code, not yet fixed. None has a failing test
yet; write one first when picking an item up (see
[unit-testing.md](unit-testing.md)). Line numbers are as of commit `4f89236`.

## Before the next release

### Release the fixes made since 0.3.3

npm has 0.3.3, which predates the fixes for the stale `onScrollToIndex` after a
drag on the dots, the drag area of the dots bar, the tab bar re-renders and the
section label types. The production app still runs a patched 0.3.2. When it
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

### Timers are not cleared on unmount

The debounced drag scroll of the dots is cancelled on unmount; these are not:

- `useHideFlatBar` and `useTimer` in [utils.ts](../src/utils.ts) (lines 103
  and 187)
- the hide timer of
  [FastScrollIndicator.tsx:130](../src/FastScrollIndicator/FastScrollIndicator.tsx#L130)
- `rescrollTimeout` in
  [FastScrollSectionFullList.tsx:116](../src/FastScrollSectionDots/FastScrollSectionFullList.tsx#L116)

Their callbacks, such as `onHide` and `withSpring` on shared values, can still
run after the screen closed. Best done together with the item above, since both
touch the section list's timers.

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

## Performance

### The indicator starts a new timer on every scroll frame

[FastScrollIndicator.tsx:258](../src/FastScrollIndicator/FastScrollIndicator.tsx#L258):
every `onScrollToOffsetPercentage` call runs `showFastScrollBar()`, which calls
`setVisible(true)` and clears and sets a `setTimeout`. Apps call this on every
`onScroll` frame. `useHideFlatBar` already skips the work when the bar is
visible (`visibleRef`); the indicator could do the same.

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
