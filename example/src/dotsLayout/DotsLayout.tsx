import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { FastScrollSectionDots, Section } from 'react-native-fast-scroll';

/**
 * Exercises the dots bar in containers of different sizes. The buttons change,
 * at runtime, the share of the screen the dots get and how many sections the
 * list has; rotating the device changes the space too. In every case all dots
 * that fit must be shown, and a touch anywhere on the bar must pick a section.
 */

const HEIGHTS = [1, 0.6, 0.3] as const;
const SECTION_COUNTS = [12, 30] as const;
const ROWS_PER_SECTION = 5;

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

const DotsLayout = () => {
  const [heightShare, setHeightShare] = useState<number>(HEIGHTS[0]);
  const [sectionCount, setSectionCount] = useState<number>(SECTION_COUNTS[0]);
  const [lastScroll, setLastScroll] = useState<string | null>(null);

  const { data, sections } = useMemo(
    () => buildList(sectionCount),
    [sectionCount]
  );

  const flashListRef = useRef<FlashList<Row> | null>(null);
  const dotsRef = useRef<React.ElementRef<typeof FastScrollSectionDots> | null>(
    null
  );

  const onScrollToIndex = useCallback(
    (index: number) => {
      flashListRef.current?.scrollToIndex({ index, animated: true });
      setLastScroll(data[index]?.title ?? '?');
    },
    [data]
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

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={styles.buttonRow}>
          <Text style={styles.label}>Dots area</Text>
          {HEIGHTS.map((share) => (
            <Pressable
              key={share}
              style={[styles.button, share === heightShare && styles.selected]}
              onPress={() => setHeightShare(share)}
            >
              <Text style={styles.buttonText}>{share * 100}%</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.buttonRow}>
          <Text style={styles.label}>Sections</Text>
          {SECTION_COUNTS.map((count) => (
            <Pressable
              key={count}
              style={[styles.button, count === sectionCount && styles.selected]}
              onPress={() => {
                setSectionCount(count);
                setLastScroll(null);
              }}
            >
              <Text style={styles.buttonText}>{count}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.status}>Last scroll: {lastScroll ?? '-'}</Text>
      </View>

      <View style={styles.listArea}>
        <FlashList
          key={sectionCount}
          ref={flashListRef}
          data={data}
          estimatedItemSize={44}
          overrideItemLayout={(layout, item) => {
            layout.size = item.type === 'header' ? 36 : 44;
          }}
          getItemType={(item) => item.type}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 20 }}
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{item.title}</Text>
              </View>
            ) : (
              <View style={styles.row}>
                <Text>{item.title}</Text>
              </View>
            )
          }
        />

        {/* The share of the list area the app gives the dots. */}
        <View
          style={[styles.dotsArea, { height: `${heightShare * 100}%` }]}
          pointerEvents={'box-none'}
        >
          <FastScrollSectionDots
            key={sectionCount}
            ref={dotsRef}
            side={'left'}
            hideFastScrollIndicatorTimeout={0}
            stickyHeaderIndicesWithData={sections}
            onScrollToIndex={onScrollToIndex}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  controls: {
    backgroundColor: '#1F3A5F',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  label: { color: 'white', fontWeight: '700', width: 80 },
  button: {
    backgroundColor: '#2C5282',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  selected: { backgroundColor: '#F6AD55' },
  buttonText: { color: 'white', fontWeight: '700' },
  status: { color: 'white', fontWeight: '700', marginTop: 4 },
  listArea: { flex: 1 },
  dotsArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C62828',
  },
  sectionHeader: {
    height: 36,
    justifyContent: 'center',
    paddingLeft: 60,
    backgroundColor: 'darkred',
  },
  sectionHeaderText: { color: 'white', fontWeight: '700' },
  row: {
    height: 44,
    justifyContent: 'center',
    paddingLeft: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
});

export default DotsLayout;
