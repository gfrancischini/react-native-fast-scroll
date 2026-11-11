# react-native-fast-scroll

Fast Scroll implementation over Flashlist for react native

![Show Case](./doc/assets/showcase.gif)

## Installation

```sh
yarn add react-native-fast-scroll
```

## Requirements

The package's peer dependencies:

1. `react-native-gesture-handler` >= 2.8
2. `react-native-reanimated` >= 2.12
3. `react-native-redash`
4. `@shopify/flash-list`

## Usage of the FastScroll Indicator

The indicator works with offsets from 0 (the top of the list) to 1 (its end),
over the height the list can scroll: its content minus its own height.

```js
import { FastScrollIndicator } from 'react-native-fast-scroll';

// ...

const contentHeight = useRef(0);
const listHeight = useRef(0);
const scrollableHeight = () =>
  Math.max(0, contentHeight.current - listHeight.current);

// The thumb was dragged: scroll the list.
const scrollToOffsetPercentage = (offsetPercentage: number) => {
  flashListRef.current?.scrollToOffset({
    offset: offsetPercentage * scrollableHeight(),
    animated: false,
  });
};

// The list scrolled: move the thumb.
const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  const scrollable = scrollableHeight();
  const offsetPercentage =
    scrollable > 0 ? event.nativeEvent.contentOffset.y / scrollable : 0;
  fastScrollIndicatorRef.current?.onScrollToOffsetPercentage(
    offsetPercentage
  );
  fastScrollSectionDotsRef.current?.onScrollToOffsetPercentage(
    offsetPercentage
  );
};

<FlashList
  ref={flashListRef}
  onScroll={onScroll}
  onContentSizeChange={(_width, height) => (contentHeight.current = height)}
  onLayout={(event) => (listHeight.current = event.nativeEvent.layout.height)}
  // ...
/>

<FastScrollIndicator
  scrollToOffsetPercentage={scrollToOffsetPercentage}
  hideFastScrollIndicatorTimeout={2000}
  side={'right'}
  ref={fastScrollIndicatorRef}
  thumbColor={'rgba(65, 64, 66, 0.6)'}
  scrollBarColor={'transparent'}
/>
```

## Usage of the FastScroll Section Tab

```js
import { FastScrollSectionTab } from 'react-native-fast-scroll';

// ...

  const onScrollToIndex = (index: number) => {
    flashListRef.current?.scrollToIndex({
      index,
      animated: true,
    });
  };


<FastScrollSectionTab
    ref={fastScrollSectionTabRef}
    onScrollToIndex={onScrollToIndex}
    stickyHeaderIndicesWithData={stickyHeaderIndicesWithData}
/>
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
