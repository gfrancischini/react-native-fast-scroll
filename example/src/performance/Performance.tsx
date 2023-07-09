import React, { useCallback, useRef } from 'react';
import { DataItem, HeaderItem, RowItem, data } from './data';

import {
  FastScrollIndicator,
  FastScrollSectionDots,
  FastScrollSectionTab,
} from 'react-native-fast-scroll';
import { FlashList, ListRenderItemInfo, ViewToken } from '@shopify/flash-list';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SectionFullData } from '../../../src/types';
import CollapsibleScrollableContainer from '../components/CollapsibleScrollableContainer';
import CategorySectionHeader from './PerformanceSectionHeader';
import CategoryCell from './PerformanceCell';
import Frame from '../components/Frame';

const Performance = () => {
  const stickyHeaderIndices = data
    .map((item, index) => {
      if (item.type === 'Header') {
        return index;
      } else {
        return null;
      }
    })
    .filter((item) => item !== null) as number[];

  const fastScrollSectionDotsRef = useRef<React.ElementRef<
    //@ts-ignore
    typeof FastScrollSectionDots
  > | null>(null);
  const fastScrollIndicatorRef = useRef<React.ElementRef<
    //@ts-ignore
    typeof FastScrollIndicator
  > | null>(null);

  const flashListRef = useRef<React.ElementRef<
    typeof FlashList<DataItem>
  > | null>(null);

  const fastScrollSectionTabRef = useRef<React.ElementRef<
    typeof FastScrollSectionTab
  > | null>(null);

  const collapsibleScrollableContainerRef =
    useRef<React.ElementRef<typeof CollapsibleScrollableContainer>>(null);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
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

      collapsibleScrollableContainerRef.current?.onScroll(event);
    },
    []
  );

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      collapsibleScrollableContainerRef.current?.onScrollEnd(event);
    },
    []
  );

  const scrollToOffsetPercentage = useCallback((offsetPercentage: number) => {
    const flashListHeight =
      flashListRef.current?.recyclerlistview_unsafe?.getContentDimension()
        .height ?? 1;
    const offset = offsetPercentage * flashListHeight;
    flashListRef.current?.scrollToOffset({
      offset,
    });
  }, []);

  const scrollToOffset = useCallback((offset: number) => {
    flashListRef.current?.scrollToOffset({
      offset,
      animated: true,
    });
  }, []);

  const onViewableItemsChanged = (info: {
    viewableItems: ViewToken[];
    changed: ViewToken[];
  }) => {
    if (info.viewableItems[0]?.index != null) {
      fastScrollSectionDotsRef.current?.onViewableIndexChanged(
        info.viewableItems[0].index
      );
      fastScrollSectionTabRef.current?.onViewableIndexChanged(
        info.viewableItems[0].index
      );
    }
  };

  const onScrollToIndex = (index: number) => {
    flashListRef.current?.scrollToIndex({
      index,
      animated: true,
    });
  };

  const stickyHeaderIndicesWithData = data
    .map((item, index) => {
      if (item.type === 'Header') {
        const header = item as HeaderItem;
        return {
          index: index,
          // @ts-ignore
          // TODO: create a new component for this text and fix the sectionfulldatav2 type
          // eslint-disable-next-line react/no-unstable-nested-components
          text: ({ section, isActive }: SectionFullData) => {
            const style = StyleSheet.create({
              category1: {
                color: section.showTextWhenInactive
                  ? '#E74C3B'
                  : isActive
                  ? undefined
                  : 'white',
                fontWeight: '600',
              },
              category2: { fontWeight: '600' },
            });
            return (
              <>
                <Text style={style.category1}>{section.category1}</Text>
                <Text> / </Text>
                <Text style={style.category2}>{section.category2}</Text>
              </>
            );
          },
          //text: `${item.category1} / ${item.category2}`,
          dotColor: header.showTextWhenInactive ? '#E74C3B' : 'white',
          showTextWhenInactive: header.showTextWhenInactive,
          category1: header.category1,
          category2: header.category2,
        };
      } else {
        return null;
      }
    })
    .filter((item) => item !== null) as any;

  return (
    <Frame>
      <View style={styles.container}>
        <CollapsibleScrollableContainer
          ref={collapsibleScrollableContainerRef}
          scrollToOffset={scrollToOffset}
          pinned={true}
        >
          <FastScrollSectionTab
            ref={fastScrollSectionTabRef}
            stickyHeaderIndicesWithData={stickyHeaderIndicesWithData.map(
              (i: any) => {
                return {
                  ...i,
                  text: `${i.category1}/${i.category2}`,
                };
              }
            )}
            onScrollToIndex={onScrollToIndex}
          />
          <View style={styles.listContainer}>
            <FlashList
              testID="FlashList"
              ref={flashListRef}
              estimatedItemSize={29}
              viewabilityConfig={{
                itemVisiblePercentThreshold: 20,
              }}
              onViewableItemsChanged={onViewableItemsChanged}
              data={data}
              stickyHeaderHiddenOnScroll={false}
              renderItem={({ item, index }: ListRenderItemInfo<DataItem>) => {
                if (item.type === 'Header') {
                  return <CategorySectionHeader header={item as HeaderItem} />;
                }
                return <CategoryCell item={item as RowItem} index={index} />;
              }}
              getItemType={(item) => {
                return item.type === 'Header' ? 'sectionHeader' : 'row';
              }}
              stickyHeaderIndices={stickyHeaderIndices}
              onScroll={onScroll}
              onScrollEndDrag={onScrollEnd}
            />

            <View style={styles.fastScrollIndicatorContainer}>
              <FastScrollIndicator
                scrollToOffsetPercentage={scrollToOffsetPercentage}
                hideFastScrollIndicatorTimeout={2000}
                side={'right'}
                ref={fastScrollIndicatorRef}
                thumbColor={'rgba(65, 64, 66, 0.6)'}
                //thumbSize={5}
                scrollBarColor={'transparent'}
              />
            </View>

            <View
              style={styles.fastScrollSectionDotsContainer}
              pointerEvents={'box-none'}
            >
              <FastScrollSectionDots
                ref={fastScrollSectionDotsRef}
                side={'left'}
                // scrollBarColor={'red'}
                hideFastScrollIndicatorTimeout={2000}
                //stickyHeaderIndices={stickyHeaderIndices}
                stickyHeaderIndicesWithData={stickyHeaderIndicesWithData}
                onScrollToIndex={onScrollToIndex}
                //dotSize={10}
                //data={data}
              />
            </View>
          </View>
        </CollapsibleScrollableContainer>
      </View>
    </Frame>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { flex: 1, overflow: 'hidden' },
  fastScrollIndicatorContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 1,
  },
  fastScrollSectionDotsContainer: {
    position: 'absolute',
    // backgroundColor: 'green',
    top: '5%',
    bottom: '5%',
    left: '5%',
    right: '5%',
    // overflow: 'hidden',
    //right: 2000,
    //maxWidth: '95%',
    // right: 10,
    //flex: 1,
    //right: 0,
  },
});

export default Performance;
