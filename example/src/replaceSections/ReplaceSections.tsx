import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
 * The app replaces the dots' sections while the dots are hidden: a filter
 * keeps only the first sections. When the dots show again, before the list
 * reports its first visible item (debounced 500 ms, like production), the
 * thumb must sit on one of the dots that are left.
 */

const SECTION_COUNT = 12;
const FILTERED_SECTION_COUNT = 4;
const ROWS_PER_SECTION = 10;
const HEADER_HEIGHT = 64;

type Row = { type: 'header' | 'row'; title: string };

const buildList = (sectionCount: number) => {
  const data: Row[] = [];
  const sections: Section[] = [];
  for (let s = 1; s <= sectionCount; s++) {
    sections.push({ index: data.length, text: `Section ${s}` });
    data.push({ type: 'header', title: `Section ${s}` });
    for (let r = 1; r <= ROWS_PER_SECTION; r++) {
      data.push({ type: 'row', title: `Product ${s}.${r}` });
    }
  }
  return { data, sections };
};

const ALL = buildList(SECTION_COUNT);
const FILTERED = buildList(FILTERED_SECTION_COUNT);

const ReplaceSections = () => {
  const [filtered, setFiltered] = useState(false);
  const { data, sections } = filtered ? FILTERED : ALL;

  const flashListRef = useRef<FlashList<Row> | null>(null);
  const dotsRef = useRef<React.ElementRef<typeof FastScrollSectionDots> | null>(
    null
  );

  const onScroll = useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
      dotsRef.current?.onScrollToOffsetPercentage(0);
    },
    []
  );

  // Like the production app, report the first visible item to the dots only
  // once the list has settled for 500 ms.
  const viewableIndexDebounce = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(viewableIndexDebounce.current), []);
  const onViewableItemsChanged = useCallback(
    (info: { viewableItems: ViewToken[] }) => {
      clearTimeout(viewableIndexDebounce.current);
      viewableIndexDebounce.current = setTimeout(() => {
        const first = info.viewableItems[0]?.index;
        if (first != null) {
          dotsRef.current?.onViewableIndexChanged(first);
        }
      }, 500);
    },
    []
  );

  const onScrollToIndex = useCallback((index: number) => {
    flashListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const contentContainerStyle = useMemo(
    () => ({ paddingTop: HEADER_HEIGHT }),
    []
  );

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

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Sections: {sections.length} of {SECTION_COUNT}
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => setFiltered((f) => !f)}
          testID="toggle-filter"
        >
          <Text style={styles.buttonText}>
            {filtered ? 'Show all' : `Only 1–${FILTERED_SECTION_COUNT}`}
          </Text>
        </Pressable>
      </View>

      <View style={styles.dots} pointerEvents={'box-none'}>
        <FastScrollSectionDots
          ref={dotsRef}
          side={'left'}
          hideFastScrollIndicatorTimeout={2000}
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
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: '#1F3A5F',
  },
  headerTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  button: {
    backgroundColor: 'white',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  buttonText: { color: '#1F3A5F', fontWeight: '700' },
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
  dots: {
    position: 'absolute',
    top: HEADER_HEIGHT + 20,
    bottom: 20,
    left: 0,
    right: 0,
  },
});

export default ReplaceSections;
