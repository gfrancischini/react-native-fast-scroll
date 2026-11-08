import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { FastScrollSectionDots, Section } from 'react-native-fast-scroll';

/**
 * Reproduces the stale `onScrollToIndex` in `FastScrollSectionDots`: the app
 * scrolls with `viewOffset` = the height of a header drawn over the list (like
 * the production catalog). When the header grows after the dots mounted, the
 * dots keep calling the first `onScrollToIndex`, with the old height.
 */

const SECTION_COUNT = 12;
const ROWS_PER_SECTION = 10;
const HEADER_SMALL = 120;
const HEADER_BIG = 250;

type Row = { type: 'header' | 'row'; title: string };

const data: Row[] = [];
const sections: Section[] = [];
for (let s = 1; s <= SECTION_COUNT; s++) {
  sections.push({ index: data.length, text: `Section ${s}` });
  data.push({ type: 'header', title: `Section ${s}` });
  for (let r = 1; r <= ROWS_PER_SECTION; r++) {
    data.push({ type: 'row', title: `Product ${s}.${r}` });
  }
}

type LastCall = { title: string; viewOffset: number; headerAtCall: number };

const StaleCallback = () => {
  const [headerHeight, setHeaderHeight] = useState(HEADER_SMALL);
  const [lastCall, setLastCall] = useState<LastCall | null>(null);
  // Every target `onScrollToIndex` scrolled to, oldest first.
  const [scrollLog, setScrollLog] = useState<string[]>([]);
  // The real header height right now, readable from any closure.
  const headerHeightRef = useRef(headerHeight);
  headerHeightRef.current = headerHeight;

  const flashListRef = useRef<FlashList<Row> | null>(null);
  const dotsRef = useRef<React.ElementRef<typeof FastScrollSectionDots> | null>(
    null
  );

  // Same shape as production: the callback depends on the header height.
  const onScrollToIndex = useCallback(
    (index: number) => {
      flashListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewOffset: headerHeight,
      });
      setLastCall({
        title: data[index]?.title ?? '?',
        viewOffset: headerHeight,
        headerAtCall: headerHeightRef.current,
      });
      setScrollLog((log) => [...log, data[index]?.title ?? '?']);
    },
    [headerHeight]
  );

  const onScroll = useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
      dotsRef.current?.onScrollToOffsetPercentage(0);
    },
    []
  );

  const onViewableItemsChanged = useCallback(
    (info: { viewableItems: ViewToken[] }) => {
      const first = info.viewableItems[0]?.index;
      if (first != null) {
        dotsRef.current?.onViewableIndexChanged(first);
      }
    },
    []
  );

  const contentContainerStyle = useMemo(
    () => ({ paddingTop: headerHeight }),
    [headerHeight]
  );

  const stale =
    lastCall != null && lastCall.viewOffset !== lastCall.headerAtCall;

  return (
    <View style={styles.container}>
      <FlashList
        ref={flashListRef}
        data={data}
        estimatedItemSize={56}
        overrideItemLayout={(layout, item) => {
          layout.size = item.type === 'header' ? 40 : 56;
        }}
        getItemType={(item) => item.type}
        contentContainerStyle={contentContainerStyle}
        onScroll={onScroll}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 20 }}
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{item.title}</Text>
            </View>
          ) : (
            <View style={styles.row}>
              <Text style={styles.rowText}>{item.title}</Text>
            </View>
          )
        }
      />

      <View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Header: {headerHeight} px</Text>
          <Pressable
            style={styles.button}
            onPress={() =>
              setHeaderHeight((h) =>
                h === HEADER_SMALL ? HEADER_BIG : HEADER_SMALL
              )
            }
          >
            <Text style={styles.buttonText}>
              {headerHeight === HEADER_SMALL ? 'Show summary' : 'Hide summary'}
            </Text>
          </Pressable>
        </View>
        {lastCall && (
          <Text style={[styles.status, stale ? styles.bad : styles.good]}>
            Last scroll: {lastCall.title}, viewOffset {lastCall.viewOffset}
            {stale ? ` (stale! should be ${lastCall.headerAtCall})` : ' (ok)'}
          </Text>
        )}
        {scrollLog.length > 0 && (
          <Text style={styles.log}>
            Scrolls:{' '}
            {scrollLog
              .slice(-3)
              .map(
                (title, i) =>
                  `#${
                    scrollLog.length - Math.min(scrollLog.length, 3) + i + 1
                  } ${title}`
              )
              .join('  →  ')}
          </Text>
        )}
        {headerHeight === HEADER_BIG && (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>Order summary</Text>
            <Text style={styles.summaryText}>12 items · $1,234.56</Text>
          </View>
        )}
      </View>

      <View
        style={[styles.dots, { top: headerHeight }]}
        pointerEvents={'box-none'}
      >
        <FastScrollSectionDots
          ref={dotsRef}
          side={'left'}
          hideFastScrollIndicatorTimeout={0}
          stickyHeaderIndicesWithData={sections}
          onScrollToIndex={onScrollToIndex}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1F3A5F',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  button: {
    backgroundColor: 'white',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  buttonText: { color: '#1F3A5F', fontWeight: '700' },
  status: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  log: { marginTop: 6, color: 'white', fontSize: 13, fontWeight: '700' },
  good: { backgroundColor: '#2E7D32', color: 'white' },
  bad: { backgroundColor: '#C62828', color: 'white' },
  summary: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2C5282',
  },
  summaryText: { color: 'white', fontSize: 15, marginVertical: 4 },
  sectionHeader: {
    height: 40,
    justifyContent: 'center',
    paddingLeft: 60,
    backgroundColor: 'darkred',
  },
  sectionHeaderText: { color: 'white', fontSize: 18, fontWeight: '700' },
  row: {
    height: 56,
    justifyContent: 'center',
    paddingLeft: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  rowText: { fontSize: 16 },
  dots: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});

export default StaleCallback;
