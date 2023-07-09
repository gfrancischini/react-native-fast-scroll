# react-native-fast-scroll

Fast Scroll implementation over Flashlist for react native

![Show Case](./doc/assets/showcase.gif)

## Installation

```sh
yarn install react-native-fast-scroll
```

## Requirements

1. React Native Gesture Handler
2. React Native Reanimated >= 2

## Usage of the FastScroll Indicator

```js
import { FastScrollIndicator } from 'react-native-fast-scroll';

// ...

const scrollToOffsetPercentage = (offsetPercentage: number) => {
    const flashListHeight =
      flashListRef.current?.recyclerlistview_unsafe?.getContentDimension()
        .height ?? 1;
    const offset = offsetPercentage * flashListHeight;
    flashListRef.current?.scrollToOffset({
      offset,
    });
}

const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  const flashListHeight =
    flashListRef.current?.recyclerlistview_unsafe?.getContentDimension()
      .height ?? 1;
  const offsetPercentage =
    event.nativeEvent.contentOffset.y / flashListHeight;
  fastScrollIndicatorRef.current?.onScrollToOffsetPercentage(
    offsetPercentage
  );
  fastScrollSectionDotsRef.current?.onScrollToOffsetPercentage(
    offsetPercentage
  );
}


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
