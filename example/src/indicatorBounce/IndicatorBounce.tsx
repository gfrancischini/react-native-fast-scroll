import React, { useCallback, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FastScrollIndicator } from 'react-native-fast-scroll';

/**
 * A short list under a `FastScrollIndicator`, to watch the thumb while the list
 * bounces past either end on iOS. Like the production app, the offset passed
 * to `onScrollToOffsetPercentage` is over the scrollable height (content minus
 * the list's own height) and is not clamped, so a bounce reports values below
 * 0 and above 1. The panel shows the last value reported.
 *
 * On a short list one frame of a fling moves the thumb a long way, so a thumb
 * that ignores the out-of-range frames visibly stops short of the end while
 * the list bounces.
 */

const ROWS = Array.from({ length: 30 }, (_, i) => i);
const ROW_HEIGHT = 44;

const IndicatorBounce = () => {
  const indicatorRef =
    useRef<React.ElementRef<typeof FastScrollIndicator>>(null);
  const listRef = useRef<FlashList<number>>(null);
  const contentHeight = useRef(0);
  const listHeight = useRef(0);
  const [reported, setReported] = useState(0);

  const scrollableHeight = useCallback(
    () => Math.max(0, contentHeight.current - listHeight.current),
    []
  );

  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.current = height;
  }, []);

  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    listHeight.current = event.nativeEvent.layout.height;
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollable = scrollableHeight();
      const offsetPercentage =
        scrollable > 0 ? event.nativeEvent.contentOffset.y / scrollable : 0;
      indicatorRef.current?.onScrollToOffsetPercentage(offsetPercentage);
      setReported(offsetPercentage);
    },
    [scrollableHeight]
  );

  const scrollToOffsetPercentage = useCallback(
    (offsetPercentage: number) => {
      listRef.current?.scrollToOffset({
        offset: offsetPercentage * scrollableHeight(),
        animated: false,
      });
    },
    [scrollableHeight]
  );

  const outOfRange = reported < 0 || reported > 1;

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text
          testID="indicator-bounce-reported"
          style={[styles.report, outOfRange && styles.reportOutOfRange]}
        >
          Offset reported: {reported.toFixed(3)}
        </Text>
      </View>
      <View style={styles.listContainer}>
        <FlashList
          ref={listRef}
          data={ROWS}
          estimatedItemSize={ROW_HEIGHT}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          onLayout={onListLayout}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text>Row {item + 1}</Text>
            </View>
          )}
        />
        <View style={styles.indicator}>
          <FastScrollIndicator
            ref={indicatorRef}
            scrollToOffsetPercentage={scrollToOffsetPercentage}
            thumbColor={'#1F3A5F'}
            scrollBarColor={'rgba(31, 58, 95, 0.12)'}
            hideFastScrollIndicatorTimeout={0}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  panel: { padding: 12, backgroundColor: '#1F3A5F' },
  report: { color: 'white', fontSize: 16, fontWeight: '600' },
  reportOutOfRange: { color: '#FFB347' },
  listContainer: { flex: 1 },
  row: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  indicator: { position: 'absolute', top: 0, bottom: 0, right: 1 },
});

export default IndicatorBounce;
