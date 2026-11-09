import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  FastScrollIndicator,
  FastScrollSectionDots,
  Section,
} from 'react-native-fast-scroll';

/**
 * Measures whether the fast scroll components keep the renders of the screen
 * around them alive, the way a production order screen leaked.
 *
 * Every render of `HeavyScreen` allocates a payload of about 160 KB and, like
 * an app, passes the components new inline callbacks and new section objects
 * that reach it. Nothing in the app keeps an older render, so after a full
 * garbage collection the live JS heap should hold one payload: every extra
 * 160 KB is a render the components (or native code on their behalf) still
 * hold. Read the process memory too (`adb shell dumpsys meminfo`): what
 * Reanimated copies to its UI runtime does not show in the JS heap.
 *
 * Needs Hermes (`jsEngine` in app.json) for `gc()` and the heap stats. Driven
 * from the debugger through `global.__leakTest`:
 * - `rerender(n)`: renders the screen `n` more times, one per frame;
 * - `unmount()` / `mount()`: closes or reopens the screen;
 * - `stats()`: runs a full GC, then returns the renders so far and the live
 *   JS heap.
 */

const PAYLOAD_LENGTH = 20_000;

const SECTIONS: Section[] = Array.from({ length: 12 }, (_, i) => ({
  index: i * 10,
  text: `Section ${i + 1}`,
}));

type Payload = { renderId: number; data: number[] };

let renders = 0;

type HermesStats = { js_allocatedBytes: number };
type HermesGlobal = {
  gc?: () => void;
  HermesInternal?: { getInstrumentedStats?: () => HermesStats };
};

const liveHeapMB = () => {
  const hermes = global as unknown as HermesGlobal;
  hermes.gc?.();
  const stats = hermes.HermesInternal?.getInstrumentedStats?.();
  return stats ? Math.round(stats.js_allocatedBytes / 1e5) / 10 : null;
};

const HeavyScreen = () => {
  renders += 1;
  const payload: Payload = {
    renderId: renders,
    data: new Array(PAYLOAD_LENGTH).fill(renders),
  };

  // New on every render, and each one reaches this render's payload, as an
  // app's callbacks and sections reach its render's data.
  const scrollToOffsetPercentage = (offsetPercentage: number) => {
    if (payload.data.length < 0) {
      console.log(offsetPercentage);
    }
  };
  const onScrollToIndex = (index: number) => {
    if (payload.data.length < 0) {
      console.log(index);
    }
  };
  const sections = SECTIONS.map((section) => ({ ...section, payload }));

  return (
    <View style={styles.lists}>
      <View style={styles.dots}>
        <FastScrollSectionDots
          stickyHeaderIndicesWithData={sections}
          onScrollToIndex={onScrollToIndex}
          hideFastScrollIndicatorTimeout={0}
        />
      </View>
      <View style={styles.indicator}>
        <FastScrollIndicator
          scrollToOffsetPercentage={scrollToOffsetPercentage}
          hideFastScrollIndicatorTimeout={0}
        />
      </View>
    </View>
  );
};

const MemoryLeak = () => {
  const [mounted, setMounted] = useState(true);
  const [, setTick] = useState(0);
  const [report, setReport] = useState('');

  useEffect(() => {
    const rerender = (count: number) =>
      new Promise<void>((resolve) => {
        let left = count;
        const step = () => {
          if (left-- <= 0) {
            resolve();
            return;
          }
          setTick((tick) => tick + 1);
          requestAnimationFrame(step);
        };
        step();
      });

    const stats = () => {
      const result = { renders, liveHeapMB: liveHeapMB() };
      setReport(JSON.stringify(result));
      return result;
    };

    (global as { __leakTest?: unknown }).__leakTest = {
      rerender,
      unmount: () => setMounted(false),
      mount: () => setMounted(true),
      stats,
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.report}>{report || 'Drive from the debugger'}</Text>
      <Pressable onPress={() => setMounted((value) => !value)}>
        <Text style={styles.button}>{mounted ? 'Unmount' : 'Mount'}</Text>
      </Pressable>
      {mounted && <HeavyScreen />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  report: { fontSize: 12, marginBottom: 8 },
  button: { color: 'blue', marginBottom: 8 },
  lists: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  dots: { width: 120 },
  indicator: { width: 30 },
});

export default MemoryLeak;
