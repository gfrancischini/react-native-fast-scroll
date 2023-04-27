import type { SectionFullDataV2, SectionV2 } from '../types';

import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { StyleSheet, ColorValue } from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  springConfig,
  useComponentSize,
  useNearestActiveSession,
} from '../utils';
import { snapPoint } from 'react-native-redash';
import FastScrollSectionFullList from './FastScrollSectionFullList';
import { debounce, throttle } from 'throttle-debounce';

export type Props = {
  stickyHeaderIndices?: number[];

  /**
   * Stick header indicies with additional data
   */
  stickyHeaderIndicesWithData?: SectionV2[];

  /**
   * The side that the thumbSize will grow
   * @default right
   */
  side?: 'left' | 'right';

  /**
   * Size of dot
   * @default 10
   */
  dotSize?: number;

  /**
   * Margin between dots;
   * @default: 12
   */
  dotMargin?: number;

  /**
   * The scale that should be applied when thumb is being pressed
   * @default 1.5
   */
  thumbScaleOnPress?: number;

  /**
   * The thumb color
   * @default 'rgba(255, 255, 255, 0.9)'
   */
  thumbColor?: ColorValue;

  /**
   * Color of dots
   */
  dotColor?: ColorValue;

  /**
   * The color of the scroll bar
   * @default 'rgba(65, 64, 66, 0.9)'
   */
  scrollBarColor?: ColorValue;

  /**
   * Implement this method to call the onScroll method of your list
   * @param offset The percentage offset to scroll to
   */
  scrollToOffsetPercentage: (offset: number) => void;

  /**
   * Hide the fast scroll indicator after timeout. This value is in ms
   * If set to 0 the scroll indicator will never be hide
   * The fast scroll indicator becomes available once the list is scrolled
   * @default 2000
   */
  hideFastScrollIndicatorTimeout?: number;

  /**
   * Implement this method to scroll your list to the required index
   * @param index The index to scroll the list
   */
  onScrollToIndex: (index: number) => void;

  /**
   * miliseconds between each section index change detection
   */
  throttleIndexChangeDelay: number;

  /**
   * miliseconds to debvounce onScrollToIndex
   */
  debounceOnScrollToIndexDelay: number;
};

export type FastScrollSectionDotsHandle = {
  /**
   * Call this method when the onScroll of your list changes
   * You need to calculate the percentage between 0 and 1
   * @param offsetPercentage between 0 and 1
   */
  onScrollToOffsetPercentage: (offsetPercentage: number) => void;

  /**
   * Call this method when viewable indicies changes
   * @param index The first visible index of the list
   */
  onViewableIndexChanged: (index: number) => void;
};

const enableLogs = true;

const FastScrollSectionDots = React.forwardRef(
  (
    {
      side = 'right',
      onScrollToIndex,
      dotSize = 10,
      thumbScaleOnPress = 1.5,
      thumbColor = 'rgba(255, 255, 255, 0.8)',
      dotColor = 'white',
      hideFastScrollIndicatorTimeout = 2000,
      scrollBarColor = 'rgba(65, 64, 66, 0.9)',
      stickyHeaderIndices,
      stickyHeaderIndicesWithData,
      dotMargin = 12,
      throttleIndexChangeDelay = 300,
      debounceOnScrollToIndexDelay = 1000,
    }: Props,
    forwardedRef: React.ForwardedRef<FastScrollSectionDotsHandle>
  ) => {
    const throttleUpdateOnJs = useRef(
      throttle(
        throttleIndexChangeDelay,
        (callback: () => void) => {
          callback();
        },
        { noLeading: false, noTrailing: false }
      )
    );
    const containerScrollY = useSharedValue(0);
    const [visible, setVisible] = useState(
      hideFastScrollIndicatorTimeout === 0
    );

    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const translateFastScrollBarXTimer = useRef<NodeJS.Timeout | null>(null);
    const disableOnScrollEvent = useSharedValue(false);
    const pointStylePositionY = useSharedValue(0);
    const fastScrollSectionFullListRef =
      useRef<React.ElementRef<typeof FastScrollSectionFullList>>(null);

    const sections = useMemo((): SectionFullDataV2[] => {
      if (stickyHeaderIndicesWithData != null) {
        return (
          stickyHeaderIndicesWithData.map((value, index) => {
            const startIndex = value.index + 1;
            return {
              ...value,
              startIndex: startIndex,
              sectionIndex: index,
            };
          }) ?? []
        );
      }

      return stickyHeaderIndices
        ? stickyHeaderIndices.map((value, index) => {
            const startIndex = value + 1;
            return {
              text: '1',
              index: value,
              startIndex: startIndex,
              sectionIndex: index,
            };
          })
        : [];
    }, [stickyHeaderIndices, stickyHeaderIndicesWithData]);

    const { nearestActiveSection, setActiveIndex } =
      useNearestActiveSession(sections);

    const sharedActiveSection = useSharedValue<number>(
      nearestActiveSection?.index ?? 0
    );

    const containerRef = useRef<React.ElementRef<typeof Animated.View>>(null);

    const { size, onLayout } = useComponentSize(containerRef);

    const scrollToIndexReScrollToIndexTime = useRef<NodeJS.Timeout | null>(
      null
    );

    const initialOffsetOfSectionDotsLabel = useRef(0);

    const updateScrollPosition = useCallback(
      (activeSession: SectionFullDataV2) => {
        let activeIndexStartY =
          (dotSize + dotMargin) * activeSession.sectionIndex;
        let activeIndexEndY =
          (dotSize + dotMargin) * activeSession.sectionIndex + 20;

        if (size && size.pageY != null) {
          const listComponentHeight = size.height;
          const amountOfMargin =
            activeSession.sectionIndex === 0 ||
            activeSession.sectionIndex === sections.length - 1
              ? 0
              : dotSize + dotMargin;
          const startY = 0 - containerScrollY.value + amountOfMargin;
          const endY = startY + listComponentHeight - amountOfMargin * 2;

          if (
            containerScrollY.value === 0 &&
            initialOffsetOfSectionDotsLabel.current == null
          ) {
            // saving the initial marginOffset to apply to other elements
            initialOffsetOfSectionDotsLabel.current = activeIndexStartY / 2;
          }

          // adding initial margin offsets to index;
          activeIndexEndY += initialOffsetOfSectionDotsLabel.current || 0;
          activeIndexStartY -= initialOffsetOfSectionDotsLabel.current || 0;
          if (activeIndexEndY > endY) {
            // this index is out of view
            containerScrollY.value =
              containerScrollY.value + (endY - activeIndexEndY);
          } else if (activeIndexStartY < startY) {
            // this index is out of view in the top
            containerScrollY.value =
              containerScrollY.value + (startY - activeIndexStartY);
          }
        }
      },
      [dotSize, dotMargin, size, sections.length, containerScrollY]
    );

    const debouncedScrollToIndex = useRef(
      debounce(
        debounceOnScrollToIndexDelay,
        (index: number) => {
          scrollToIndex(index);
        },
        { atBegin: false }
      )
    );

    const reScrollToIndexTime: number = 0;
    const scrollToIndex = useCallback(
      (index: number) => {
        const section = setActiveIndex(index);
        if (scrollToIndexReScrollToIndexTime.current != null) {
          // clearing previous timeout
          clearTimeout(scrollToIndexReScrollToIndexTime.current);
          scrollToIndexReScrollToIndexTime.current = null;
        }
        onScrollToIndex(index);
        //ignoreVisibleItemsFor(500);
        if (reScrollToIndexTime !== 0) {
          scrollToIndexReScrollToIndexTime.current = setTimeout(() => {
            onScrollToIndex(index);
          }, reScrollToIndexTime);
        }

        if (section != null) {
          pointStylePositionY.value =
            dotMargin * (section.sectionIndex + 1) +
            dotSize * section.sectionIndex +
            dotSize / 2;

          updateScrollPosition(section);
        }
      },
      [
        dotMargin,
        dotSize,
        onScrollToIndex,
        pointStylePositionY,
        setActiveIndex,
        updateScrollPosition,
      ]
    );

    const clearTimeoutFastScrollBar = () => {
      if (translateFastScrollBarXTimer.current != null) {
        enableLogs && console.log('clearTimeoutFastScrollBar');
        clearTimeout(translateFastScrollBarXTimer.current);
        translateFastScrollBarXTimer.current = null;
      }
    };

    const scheduleHideFastScrollbar = useCallback(() => {
      if (hideFastScrollIndicatorTimeout === 0) {
        // we dont hide the scroll indicator when the value is zero
        return;
      }
      clearTimeoutFastScrollBar();
      translateFastScrollBarXTimer.current = setTimeout(() => {
        translateFastScrollBarXTimer.current = null;
        setVisible(false);
      }, hideFastScrollIndicatorTimeout);
    }, [hideFastScrollIndicatorTimeout]);

    const showFastScrollBar = useCallback(() => {
      if (!disableOnScrollEvent.value) {
        // the bar is not visible so lets show it
        setVisible(true);
        scheduleHideFastScrollbar();
      }
    }, [disableOnScrollEvent, scheduleHideFastScrollbar]);

    useEffect(() => {
      // dealing with prop change. if timeout is 0 means we should always show the fast scroll indicator
      if (hideFastScrollIndicatorTimeout === 0) {
        showFastScrollBar();
      } else {
        scheduleHideFastScrollbar();
      }
    }, [
      hideFastScrollIndicatorTimeout,
      scheduleHideFastScrollbar,
      showFastScrollBar,
    ]);

    const calculateYPosition = (y: number) => {
      'worklet';
      const minHeight = dotSize / 2;
      const maxHeight =
        ((sections[sections.length - 1]?.sectionIndex || 0) + 1) *
          (dotMargin + dotSize) -
        dotSize / 2;
      const yPosition =
        y < minHeight ? minHeight : y > maxHeight ? maxHeight : y;
      const yPercentage = (yPosition - minHeight) / (maxHeight - minHeight);
      return {
        yPosition: yPosition - dotSize / 2,
        yPercentage,
      };
    };

    const updateOnJS = () => {
      enableLogs && console.log('updateOnJS');
      if (sharedActiveSection.value !== nearestActiveSection?.index) {
        const section = setActiveIndex(sharedActiveSection.value);

        debouncedScrollToIndex.current(sharedActiveSection.value);
        if (section != null) {
          updateScrollPosition(section);
          fastScrollSectionFullListRef.current?.show(section);
          enableLogs && console.log('updateOnJS', section);
        }
      }
      clearTimeoutFastScrollBar();
    };

    const fastScrollFullListOnScrollToIndex = useCallback(
      (index: number) => {
        // clear the debounce that might be still in place
        enableLogs && console.log('debouncedScrollToIndex.current.cancel');
        debouncedScrollToIndex.current.cancel({ upcomingOnly: true });
        scrollToIndex(index);
      },
      [scrollToIndex]
    );

    const updateOnJSThrottle = () => throttleUpdateOnJs.current(updateOnJS);

    const onGestureEvent = useAnimatedGestureHandler<
      PanGestureHandlerGestureEvent,
      { y: number }
    >({
      onStart: (event, ctx) => {
        const { yPosition } = calculateYPosition(
          event.y + Math.abs(containerScrollY.value)
        );
        disableOnScrollEvent.value = true;
        pointStylePositionY.value = yPosition;
        ctx.y = translateY.value;
        scale.value = thumbScaleOnPress;

        if (translateFastScrollBarXTimer.current != null) {
          runOnJS(clearTimeoutFastScrollBar)();
        }
      },
      onActive: (event) => {
        const { yPosition } = calculateYPosition(
          event.y + Math.abs(containerScrollY.value)
        );
        pointStylePositionY.value = yPosition;
        disableOnScrollEvent.value = true;
        const snapPoints = sections.map(
          (_, index) => dotMargin * (index + 1) + dotSize * index
        );
        const newTranslate = snapPoint(yPosition, 0, snapPoints);
        const section = sections.find(
          (_, index) =>
            dotMargin * (index + 1) + dotSize * index === newTranslate
        );
        if (section && sharedActiveSection.value !== section.index) {
          sharedActiveSection.value = section.index;

          runOnJS(updateOnJSThrottle)();
        }
      },
      onFinish: (event) => {
        const { yPosition } = calculateYPosition(
          event.y + Math.abs(containerScrollY.value)
        );

        const snapPoints = sections.map(
          (_, index) => dotMargin * (index + 1) + dotSize * index
        );
        const newTranslate = snapPoint(yPosition, 0, snapPoints);
        const section = sections.find(
          (_, index) =>
            dotMargin * (index + 1) + dotSize * index === newTranslate
        );
        if (section) {
          sharedActiveSection.value = section.index;
        }

        pointStylePositionY.value = newTranslate + dotSize / 2;
        scale.value = 1;

        // console.log('onstart', {
        //   containerScrollY: containerScrollY.value,
        //   eventy: event.y,
        //   yPosition,
        //   newTranslate,
        //   snapPoints,
        // });

        runOnJS(updateOnJSThrottle)();
      },
    });

    const pointStyle = useAnimatedStyle(() => {
      return {
        transform: [
          {
            translateY: pointStylePositionY.value,
          },
          { scale: withSpring(scale.value, springConfig) },
        ],
      };
    });

    React.useImperativeHandle(
      forwardedRef,
      (): FastScrollSectionDotsHandle => ({
        onScrollToOffsetPercentage() {
          showFastScrollBar();
        },

        onViewableIndexChanged(index: number) {
          if (disableOnScrollEvent.value) {
            // event is ignored as the scrolling is being done by the thumbs
            return;
          }

          enableLogs && console.log('onViewableIndexChanged');

          const section = setActiveIndex(index);
          if (section != null) {
            pointStylePositionY.value =
              dotMargin * (section.sectionIndex + 1) +
              dotSize * section.sectionIndex +
              dotSize / 2;

            sharedActiveSection.value = section.index;
            updateScrollPosition(section);
          }
        },
      })
    );

    const enteringAnimation = (
      side === 'left' ? SlideInLeft : SlideInRight
    ).duration(500);

    const exitingAnimation = (
      side === 'left' ? SlideOutLeft : SlideOutRight
    ).duration(500);

    //const elements = [...Array(100)];

    const hitSlop = useMemo(() => {
      if (side === 'left') {
        return { horizontal: 20 };
      } else {
        return { horizontal: 20 };
      }
    }, [side]);

    const containerScrollStyle = useAnimatedStyle(() => {
      return {
        transform: [
          {
            translateY: withSpring(containerScrollY.value, springConfig),
          },
        ],
      };
    });

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            flex: 1,
            flexDirection: 'row',
          },
          dot: {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize,
            backgroundColor: dotColor,
            overflow: 'visible',
          },
          scrollBar: {
            backgroundColor: scrollBarColor,
            overflow: 'scroll',
            paddingHorizontal: 5,
            borderRadius: dotSize,
            marginRight: 10,
            paddingBottom: 5,
          },
          text: { fontSize: 10 },
          thumb: {
            left: -5,
            right: -5,
            top: -dotSize / 4,
            height: dotSize / 2,
            backgroundColor: thumbColor,
            position: 'absolute',
            alignSelf: 'center',
            elevation: 2000,
            zIndex: 2000,
          },
          dotTagContainer: {
            flex: 1,
            top:
              (dotSize + dotMargin) * (nearestActiveSection?.sectionIndex ?? 0),
          },
        }),
      [
        dotSize,
        dotColor,
        scrollBarColor,
        thumbColor,
        dotMargin,
        nearestActiveSection?.sectionIndex,
      ]
    );

    const onHide = useCallback(() => {
      scheduleHideFastScrollbar();
      setTimeout(() => {
        disableOnScrollEvent.value = false;
      }, 2000);
    }, [disableOnScrollEvent, scheduleHideFastScrollbar]);

    if (sections.length === 0) {
      return null;
    }

    return (
      <Animated.View
        style={[styles.container]}
        pointerEvents={'box-none'}
        collapsable={false}
      >
        {visible && (
          <PanGestureHandler onGestureEvent={onGestureEvent} hitSlop={hitSlop}>
            <Animated.View
              entering={enteringAnimation}
              exiting={exitingAnimation}
              onLayout={onLayout}
              ref={containerRef}
              style={[styles.scrollBar]}
              collapsable={false}
            >
              <Animated.View style={containerScrollStyle} collapsable={false}>
                {sections.map((section, index) => {
                  return (
                    <Animated.View
                      collapsable={false}
                      key={index}
                      style={[
                        styles.dot,
                        {
                          top: dotMargin * (index + 1),
                          backgroundColor:
                            section.dotColor ?? styles.dot.backgroundColor,
                        },
                      ]}
                    />
                  );
                })}
                <Animated.View style={[styles.thumb, pointStyle]} />
              </Animated.View>
            </Animated.View>
          </PanGestureHandler>
        )}
        <FastScrollSectionFullList
          ref={fastScrollSectionFullListRef}
          sections={sections}
          nearestActiveSection={nearestActiveSection}
          scrollToIndex={fastScrollFullListOnScrollToIndex}
          onHide={onHide}
          backgroundColor={scrollBarColor}
        />
      </Animated.View>
    );
  }
);

export default React.memo(FastScrollSectionDots);
