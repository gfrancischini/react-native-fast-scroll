import type { SectionFullData } from '../types';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ColorValue,
  FlatList,
  LayoutChangeEvent,
  ListRenderItemInfo,
  StyleSheet,
} from 'react-native';

import Animated, { SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { useTimer } from '../utils';
import FastScrollSectionFullListItem from './FastScrollSectionFullListItem';

type Props = {
  /**
   * Section to render
   */
  sections: SectionFullData[];

  /**
   * Implement this method to scroll your list to the specific index
   * @param index
   * @returns
   */
  scrollToIndex: (index: number) => void;

  /**
   * Callback for hiding this component
   */
  onHide: () => void;

  /**
   * The background color of the list
   */
  backgroundColor: ColorValue;
};

export type FastScrollSectionFullListHandle = {
  /**
   * Call this method when index change or when to show this bar
   * @param index The first index
   */
  show: (activeSection: SectionFullData) => void;

  /**
   * Keeps the list open while `held` (a finger rests on the dots), then
   * closes it after the usual delay once released.
   */
  hold: (held: boolean) => void;
};

const FastScrollSectionFullList = React.forwardRef(
  (
    { sections, scrollToIndex, onHide, backgroundColor }: Props,
    forwardedRef: React.ForwardedRef<FastScrollSectionFullListHandle>
  ) => {
    /**
     * `Animated.FlatList` forwards its ref to React Native's `FlatList`, but
     * the typings disagree across Reanimated versions: 2.12 declares the
     * instance as a `View` (`interface FlatList<T> extends View<T>`), which has
     * no `scrollToIndex`, and 3 declares React Native's `FlatList`. The
     * callback takes any object so it fits both, and holds the ref as what it
     * is at runtime.
     */
    const flatListRef = useRef<FlatList<SectionFullData> | null>(null);
    const setFlatListRef = useCallback((list: object | null) => {
      flatListRef.current = list as FlatList<SectionFullData> | null;
    }, []);

    const [activeIndexVisible, setActiveIndexVisible] = useState(false);

    const [activeSection, setActiveSection] = useState<SectionFullData | null>(
      null
    );

    const activeIndexVisibleCallbacks = useMemo(() => {
      return {
        callbackTimeout: () => {
          setActiveIndexVisible(false);
          onHide();
        },
        callbackSchedule: () => {
          setActiveIndexVisible(true);
        },
        timeout: 3000,
      };
    }, [onHide]);

    const [startHideTimer, clearHideTimer, scheduleHideTimer] = useTimer(
      activeIndexVisibleCallbacks
    );

    // The list closes a while after the last show() or scroll. show() only
    // runs when the finger touches, reaches another dot or lifts, so a finger
    // on the dots holds the list open instead.
    const held = useRef(false);
    const startShowActiveIndexVisibleTimer = useCallback(() => {
      startHideTimer();
      if (held.current) {
        clearHideTimer();
      }
    }, [clearHideTimer, startHideTimer]);

    const closeAndScrollToIndex = useCallback(
      (index: number) => {
        setActiveIndexVisible(false);
        scrollToIndex(index);
      },
      [scrollToIndex]
    );

    const rescrollTimeout = useRef<NodeJS.Timeout | null>(null);

    // A screen can close before the retry runs.
    useEffect(
      () => () => {
        if (rescrollTimeout.current) {
          clearTimeout(rescrollTimeout.current);
        }
      },
      []
    );

    /** Centers the row of `section` in the list, when the list is on screen. */
    const centerSection = useCallback(
      (section: SectionFullData, animated?: boolean) => {
        flatListRef.current?.scrollToIndex({
          index: section.sectionIndex,
          viewPosition: 0.5,
          animated,
        });
      },
      []
    );

    // The section to center waits here until its row is laid out. The list
    // renders nothing while closed, so the touch that opens it has no list to
    // scroll yet; then it renders its first rows and the rest a batch at a
    // time, each batch growing its content, so a row far down is laid out
    // only later.
    const sectionToCenter = useRef<SectionFullData | null>(null);
    const centerFailed = useRef(false);

    // Without an animation: on Android, an animated scroll started while the
    // list is still laying out its rows does not move it.
    const centerPendingSection = useCallback(() => {
      if (!sectionToCenter.current || !flatListRef.current) {
        return;
      }
      centerFailed.current = false;
      centerSection(sectionToCenter.current, false);
      if (!centerFailed.current) {
        sectionToCenter.current = null;
      }
    }, [centerSection]);

    const listHeight = useRef(0);
    const onLayout = useCallback((event: LayoutChangeEvent) => {
      listHeight.current = event.nativeEvent.layout.height;
    }, []);

    // Called when the row is not laid out yet. Once some rows are, jump to
    // where it should be from their average height: that renders the rows
    // around it, and the next content size change centers it exactly.
    const onScrollToIndexFailed = useCallback(
      ({
        index,
        averageItemLength,
      }: {
        index: number;
        averageItemLength: number;
      }) => {
        centerFailed.current = true;
        if (averageItemLength === 0) {
          return;
        }
        flatListRef.current?.scrollToOffset({
          offset: Math.max(
            0,
            averageItemLength * (index + 0.5) - listHeight.current / 2
          ),
          animated: false,
        });
      },
      []
    );

    React.useImperativeHandle(
      forwardedRef,
      (): FastScrollSectionFullListHandle => ({
        show(section: SectionFullData) {
          setActiveIndexVisible(true);
          setActiveSection(section);
          startShowActiveIndexVisibleTimer();
          sectionToCenter.current = section;
          centerPendingSection();
          // Again a second later, in case the list has not centered it by then.
          if (rescrollTimeout.current) {
            clearTimeout(rescrollTimeout.current);
            rescrollTimeout.current = null;
          }
          rescrollTimeout.current = setTimeout(() => {
            rescrollTimeout.current = null;
            centerSection(section);
          }, 1000);
        },
        hold(isHeld: boolean) {
          held.current = isHeld;
          if (isHeld) {
            clearHideTimer();
          } else {
            scheduleHideTimer();
          }
        },
      })
    );

    const styles = useMemo(
      () =>
        StyleSheet.create({
          list: {
            flex: 1,
            backgroundColor,
            borderRadius: 16,
          },
          listContainer: {
            paddingVertical: 5,
          },
        }),
      [backgroundColor]
    );

    if (!activeIndexVisible) {
      return null;
    }

    return (
      <Animated.FlatList
        entering={SlideInLeft}
        exiting={SlideOutLeft}
        ref={setFlatListRef}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        onLayout={onLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onContentSizeChange={centerPendingSection}
        onScroll={() => {
          startShowActiveIndexVisibleTimer();
        }}
        data={sections}
        renderItem={({ item, index }: ListRenderItemInfo<SectionFullData>) => (
          <FastScrollSectionFullListItem
            index={index}
            isActive={item.sectionIndex === activeSection?.sectionIndex}
            item={item}
            scrollToIndex={closeAndScrollToIndex}
          />
        )}
        extraData={activeSection?.sectionIndex}
      />
    );
  }
);

export default React.memo(FastScrollSectionFullList);
