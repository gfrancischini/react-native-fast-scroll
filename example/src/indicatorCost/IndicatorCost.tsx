import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSharedValue } from 'react-native-reanimated';
import { FastScrollIndicator } from 'react-native-fast-scroll';

/**
 * Times `FastScrollIndicator`'s `onScrollToOffsetPercentage` on the JS thread,
 * the handle apps call on every scroll frame. On Reanimated 3, reading a
 * shared value from JS takes the UI runtime's lock, so it waits whenever the
 * UI thread is running worklets, as it does while the list scrolls and the
 * indicator animates. Measure with a production bundle
 * (`expo start --no-dev --minify`) and clear Expo Go's data between versions:
 * it keeps reusing a cached production bundle.
 *
 * - "Loop": calls the handle 1000 times in a row and reports the time per
 *   call.
 * - Scrolling the list: every `onScroll` frame calls the handle, as an app
 *   does, and times that call alone. "Scroll stats" reports them; "Reset"
 *   clears them.
 * - "Reads": in the same frames, right after the handle, the time of two
 *   reads from JS of shared values shaped like the ones the indicator's
 *   handle read before it kept JS copies (a flag and a layout object). It
 *   shows what those two reads cost under the same load, frame by frame,
 *   whatever version of the indicator the example runs.
 *
 * Also driven from the debugger through `global.__indicatorCost`
 * (`loop(n)`, `scrollStats()`, `reset()`), which return the same numbers.
 */

const ROWS = Array.from({ length: 2000 }, (_, i) => i);
const ROW_HEIGHT = 44;
const LOOP_CALLS = 1000;

type Stats = {
  calls: number;
  meanUs: number;
  p50Us: number;
  p95Us: number;
  maxUs: number;
};

const toStats = (durationsMs: number[]): Stats => {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const sum = sorted.reduce((total, ms) => total + ms, 0);
  const us = (ms: number) => Math.round(ms * 1000);
  return {
    calls: sorted.length,
    meanUs: us(sorted.length ? sum / sorted.length : 0),
    p50Us: us(at(0.5)),
    p95Us: us(at(0.95)),
    maxUs: us(sorted[sorted.length - 1] ?? 0),
  };
};

const format = (label: string, stats: Stats) =>
  `${label}: ${stats.calls} calls, mean ${stats.meanUs} µs, p50 ${stats.p50Us} µs, p95 ${stats.p95Us} µs, max ${stats.maxUs} µs`;

const IndicatorCost = () => {
  const indicatorRef =
    useRef<React.ElementRef<typeof FastScrollIndicator>>(null);
  const listRef = useRef<FlashList<number>>(null);
  const scrollDurations = useRef<number[]>([]);
  const readDurations = useRef<number[]>([]);
  const readSink = useRef(0);
  const probeFlag = useSharedValue(false);
  const probeLayout = useSharedValue({ x: 0, y: 0, height: 0, width: 0 });
  const [loopReport, setLoopReport] = useState('Loop: -');
  const [scrollReport, setScrollReport] = useState('Scroll: -');
  const [readsReport, setReadsReport] = useState('Reads: -');

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const scrollable = contentSize.height - layoutMeasurement.height;
      const offsetPercentage =
        scrollable > 0
          ? Math.min(1, Math.max(0, contentOffset.y / scrollable))
          : 0;
      const start = performance.now();
      indicatorRef.current?.onScrollToOffsetPercentage(offsetPercentage);
      scrollDurations.current.push(performance.now() - start);

      const readStart = performance.now();
      readSink.current += (probeFlag.value ? 1 : 0) + probeLayout.value.height;
      readDurations.current.push(performance.now() - readStart);
    },
    [probeFlag, probeLayout]
  );

  const scrollToOffsetPercentage = useCallback((offsetPercentage: number) => {
    const scrollable = ROWS.length * ROW_HEIGHT;
    listRef.current?.scrollToOffset({
      offset: offsetPercentage * scrollable,
      animated: false,
    });
  }, []);

  const loop = useCallback((calls: number = LOOP_CALLS) => {
    const durations: number[] = [];
    for (let i = 0; i < calls; i++) {
      const start = performance.now();
      indicatorRef.current?.onScrollToOffsetPercentage(i / calls);
      durations.push(performance.now() - start);
    }
    const stats = toStats(durations);
    setLoopReport(format('Loop', stats));
    return stats;
  }, []);

  const scrollStats = useCallback(() => {
    const handle = toStats(scrollDurations.current);
    const reads = toStats(readDurations.current);
    setScrollReport(format('Scroll', handle));
    setReadsReport(format('Reads', reads));
    return { handle, reads };
  }, []);

  const reset = useCallback(() => {
    scrollDurations.current = [];
    readDurations.current = [];
    setScrollReport('Scroll: -');
    setReadsReport('Reads: -');
  }, []);

  useEffect(() => {
    (global as { __indicatorCost?: unknown }).__indicatorCost = {
      loop,
      scrollStats,
      reset,
    };
  }, [loop, reset, scrollStats]);

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={styles.buttons}>
          <Pressable testID="indicator-cost-loop" onPress={() => loop()}>
            <Text style={styles.button}>Loop</Text>
          </Pressable>
          <Pressable testID="indicator-cost-scroll" onPress={scrollStats}>
            <Text style={styles.button}>Scroll stats</Text>
          </Pressable>
          <Pressable testID="indicator-cost-reset" onPress={reset}>
            <Text style={styles.button}>Reset</Text>
          </Pressable>
        </View>
        <Text testID="indicator-cost-loop-report" style={styles.report}>
          {loopReport}
        </Text>
        <Text testID="indicator-cost-scroll-report" style={styles.report}>
          {scrollReport}
        </Text>
        <Text testID="indicator-cost-reads-report" style={styles.report}>
          {readsReport}
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
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  panel: { padding: 12, backgroundColor: '#1F3A5F' },
  buttons: { flexDirection: 'row', marginBottom: 8 },
  button: {
    color: 'white',
    fontWeight: '600',
    backgroundColor: '#2E5A8F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  report: { color: 'white', fontSize: 12, marginTop: 2 },
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

export default IndicatorCost;
