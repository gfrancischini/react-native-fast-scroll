import React, { useCallback, useRef } from 'react';
import { CategoryItemData, data, Header, Product } from './data/categories';

import {
  FastScrollIndicator,
  FastScrollSectionDots,
  FastScrollSectionTab,
  Section,
  SectionFullData,
  SectionTextProps,
} from 'react-native-fast-scroll';
import { FlashList, ListRenderItemInfo, ViewToken } from '@shopify/flash-list';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import CollapsibleScrollableContainer from '../components/CollapsibleScrollableContainer';
import CategorySectionHeader from './CategorySectionHeader';
import CategoryCell from './CategoryCell';
import Frame from '../components/Frame';

/** The fields this app adds to each section, on top of the library's. */
type CategoryFields = Pick<
  Header,
  'category1' | 'category2' | 'showTextWhenInactive'
>;

/**
 * The label of a category in the tab bar and in the dots' section list. Like
 * the production app, it reads the app's own fields from the `section` prop.
 */
const CategorySectionLabel = React.memo(function CategorySectionLabel({
  section,
  isActive,
}: SectionTextProps) {
  const { category1, category2, showTextWhenInactive } =
    section as SectionFullData & CategoryFields;
  return (
    <>
      <Text
        style={[
          styles.labelCategory,
          showTextWhenInactive
            ? styles.labelHighlighted
            : isActive
            ? undefined
            : styles.labelInactive,
        ]}
      >
        {category1}
      </Text>
      <Text> / </Text>
      <Text style={styles.labelCategory}>{category2}</Text>
    </>
  );
});

const Categories = () => {
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
    typeof FlashList<CategoryItemData>
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
    }
  };

  const onScrollToIndex = (index: number) => {
    flashListRef.current?.scrollToIndex({
      index,
      animated: true,
    });
  };

  const stickyHeaderIndicesWithData = data.flatMap(
    (item, index): (Section & CategoryFields)[] => {
      if (item.type !== 'Header') {
        return [];
      }
      const header = item as Header;
      return [
        {
          index: index,
          text: CategorySectionLabel,
          dotColor: header.showTextWhenInactive ? '#E74C3B' : 'white',
          showTextWhenInactive: header.showTextWhenInactive,
          category1: header.category1,
          category2: header.category2,
        },
      ];
    }
  );

  return (
    <Frame>
      <View style={styles.container}>
        <CollapsibleScrollableContainer
          ref={collapsibleScrollableContainerRef}
          scrollToOffset={scrollToOffset}
          pinned={true}
        >
          <FastScrollSectionTab
            stickyHeaderIndicesWithData={stickyHeaderIndicesWithData}
            onScrollToIndex={onScrollToIndex}
          />
          <View style={styles.listContainer}>
            <FlashList
              testID="FlashList"
              ref={flashListRef}
              estimatedItemSize={98.2}
              overrideItemLayout={(layout, item: CategoryItemData) => {
                if (item.type === 'Header') {
                  layout.size = 32.4;
                } else {
                  layout.size = 98.2;
                }
              }}
              viewabilityConfig={{
                itemVisiblePercentThreshold: 20,
              }}
              onViewableItemsChanged={onViewableItemsChanged}
              data={data}
              stickyHeaderHiddenOnScroll={false}
              renderItem={({
                item,
                index,
              }: ListRenderItemInfo<CategoryItemData>) => {
                if (item.type === 'Header') {
                  return <CategorySectionHeader header={item as Header} />;
                }
                return <CategoryCell product={item as Product} index={index} />;
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
  labelCategory: { fontWeight: '600' },
  labelHighlighted: { color: '#E74C3B' },
  labelInactive: { color: 'white' },
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

export default Categories;
