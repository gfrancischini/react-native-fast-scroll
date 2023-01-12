# react-native-fast-scroll

Fast Scroll implementation over Flashlist for react native

## Installation

```sh
npm install react-native-fast-scroll
```

## Usage

```js
import { multiply } from 'react-native-fast-scroll';

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

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
