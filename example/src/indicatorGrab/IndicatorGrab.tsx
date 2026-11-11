import React, { useCallback, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FastScrollIndicator } from 'react-native-fast-scroll';

/**
 * Grabs `FastScrollIndicator`'s thumb while the JS thread is busy, as on a
 * heavy screen. Every `onScroll` frame calls the handle and then keeps the JS
 * thread busy for `BUSY_MS`, so while the list flings its scroll events pile
 * up there.
 *
 * Fling the list, then rest a finger on the track without moving it. The pan
 * runs on the UI thread and puts the thumb under the finger at once, but its
 * "finger down" message reaches the JS thread behind those scroll events. The
 * thumb must stay under the finger while they are handled.
 */

const ROWS = Array.from({ length: 2000 }, (_, i) => i);
const ROW_HEIGHT = 44;
const BUSY_MS = 40;
const THUMB = { width: 10, height: 60, borderRadius: 5 };

const busyFor = (ms: number) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // The work a heavy screen does on each scroll frame.
  }
};

const IndicatorGrab = () => {
  const indicatorRef =
    useRef<React.ElementRef<typeof FastScrollIndicator>>(null);
  const listRef = useRef<FlashList<number>>(null);
  const scrollableHeight = useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      scrollableHeight.current = Math.max(
        0,
        contentSize.height - layoutMeasurement.height
      );
      const offsetPercentage =
        scrollableHeight.current > 0
          ? contentOffset.y / scrollableHeight.current
          : 0;
      indicatorRef.current?.onScrollToOffsetPercentage(offsetPercentage);
      busyFor(BUSY_MS);
    },
    []
  );

  const scrollToOffsetPercentage = useCallback((offsetPercentage: number) => {
    listRef.current?.scrollToOffset({
      offset: offsetPercentage * scrollableHeight.current,
      animated: false,
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.report}>
          Each scroll frame keeps the JS thread busy for {BUSY_MS} ms. Fling the
          list, then rest a finger on the track: the thumb stays under it.
        </Text>
      </View>
      <View style={styles.listContainer}>
        <FlashList
          ref={listRef}
          data={ROWS}
          estimatedItemSize={ROW_HEIGHT}
          onScroll={onScroll}
          scrollEventThrottle={16}
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
            thumbSize={THUMB}
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
  report: { color: 'white', fontSize: 14 },
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

export default IndicatorGrab;
