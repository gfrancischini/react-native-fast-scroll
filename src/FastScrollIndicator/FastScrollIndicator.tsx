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
import { springConfig } from '../utils';

export type FastScrollIndicatorProps = {
  /**
   * The side that the thumbSize will grow
   * @default right
   */
  side?: 'left' | 'right';

  /**
   * Size of thumb (scrolling thumb)
   * @default 15
   */
  thumbSize?: {
    height: number;
    width: number;
    borderRadius: number;
  };

  /**
   * The scale that should be applied when thumb is being pressed
   * @default 1.5
   */
  thumbScaleOnPress?: number;

  /**
   * The thumb color
   * @default gray
   */
  thumbColor?: ColorValue;

  /**
   * The color of the scroll bar
   * @default transparent
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
};

export type FastScrollIndicatorHandle = {
  /**
   * Call this method when the onScroll of your list changes
   * You need to calculate the percentage between 0 and 1
   * @param offsetPercentage between 0 and 1
   * @returns
   */
  onScrollToOffsetPercentage: (offsetPercentage: number) => void;
};

export const FastScrollIndicator = React.forwardRef(
  (
    {
      side = 'right',
      scrollToOffsetPercentage,
      thumbSize = {
        borderRadius: 7,
        height: 50,
        width: 7,
      },
      thumbScaleOnPress = 1.5,
      thumbColor = '#CFCFCF',
      hideFastScrollIndicatorTimeout = 2000,
      scrollBarColor = 'transparent',
    }: FastScrollIndicatorProps,
    forwardedRef: React.ForwardedRef<FastScrollIndicatorHandle>
  ) => {
    const [visible, setVisible] = useState(
      hideFastScrollIndicatorTimeout === 0
    );
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const translateFastScrollBarXTimer = useRef<NodeJS.Timeout | null>(null);
    const disableOnScrollEvent = useSharedValue(false);

    const viewLayout = useSharedValue({ x: 0, y: 0, height: 0, width: 0 });

    const clearTimeoutFastScrollBar = () => {
      if (translateFastScrollBarXTimer.current != null) {
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
      setVisible(true);
      scheduleHideFastScrollbar();
    }, [scheduleHideFastScrollbar]);

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

    const processScrollJSThread = (offsetPercentage: number) => {
      scrollToOffsetPercentage(offsetPercentage);
    };

    const processScroll = (offsetPercentage: number) => {
      'worklet';
      runOnJS(processScrollJSThread)(offsetPercentage);
    };

    const calculateYPosition = (y: number) => {
      'worklet';
      const minHeight = thumbSize.height / 2;
      const maxHeight = viewLayout.value.height - thumbSize.height / 2;
      const yPosition =
        y < minHeight ? minHeight : y > maxHeight ? maxHeight : y;
      const yPercentage = (yPosition - minHeight) / (maxHeight - minHeight);
      return { yPosition: yPosition - thumbSize.height / 2, yPercentage };
    };

    const onGestureEvent = useAnimatedGestureHandler<
      PanGestureHandlerGestureEvent,
      { y: number }
    >({
      onStart: (event, ctx) => {
        const { yPosition, yPercentage } = calculateYPosition(event.y);
        disableOnScrollEvent.value = true;
        translateY.value = yPosition;
        ctx.y = translateY.value;
        processScroll(yPercentage);
        scale.value = thumbScaleOnPress;
        runOnJS(clearTimeoutFastScrollBar)();
      },
      onActive: (event) => {
        const { yPosition, yPercentage } = calculateYPosition(event.y);
        translateY.value = yPosition;
        processScroll(yPercentage);
        disableOnScrollEvent.value = true;
        runOnJS(clearTimeoutFastScrollBar)();
      },
      onFinish: (event) => {
        const { yPosition, yPercentage } = calculateYPosition(event.y);
        processScroll(yPercentage);
        translateY.value = yPosition;
        scale.value = 1;
        disableOnScrollEvent.value = false;
        runOnJS(scheduleHideFastScrollbar)();
      },
    });

    const pointStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateY: translateY.value },
          {
            translateX: withSpring(
              (1 - scale.value) *
                ((side === 'left' ? -thumbSize.width : thumbSize.width) / 2),
              springConfig
            ),
          },
          { scale: withSpring(scale.value, springConfig) },
        ],
      };
    });

    React.useImperativeHandle(
      forwardedRef,
      (): FastScrollIndicatorHandle => ({
        onScrollToOffsetPercentage(offsetPercentage: number) {
          if (offsetPercentage < 0 || offsetPercentage > 1) {
            // console.warn(
            //   `onScrollToOffsetPercentage only allow values between 0 and 1. Received = ${offsetPercentage}`
            // );
            return;
          }

          if (disableOnScrollEvent.value) {
            // event is ignored as the scrolling is being done by the thumbs
            return;
          }

          translateY.value =
            offsetPercentage * (viewLayout.value.height - thumbSize.height);

          showFastScrollBar();
        },
      })
    );

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: { flex: 1 },
          thumb: {
            width: thumbSize.width,
            height: thumbSize.height,
            borderRadius: thumbSize.borderRadius,
            backgroundColor: thumbColor,
            position: 'absolute',
          },
          scrollBar: {
            flex: 1,
            backgroundColor: scrollBarColor,
            width: thumbSize.width,
          },
          text: { fontSize: 10 },
        }),
      [scrollBarColor, thumbSize, thumbColor]
    );

    const enteringAnimation = (
      side === 'left' ? SlideInLeft : SlideInRight
    ).duration(500);

    const exitingAnimation = (
      side === 'left' ? SlideOutLeft : SlideOutRight
    ).duration(500);

    return (
      <>
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          hitSlop={{ horizontal: 20 }}
        >
          <Animated.View
            style={styles.container}
            onLayout={(event) => (viewLayout.value = event.nativeEvent.layout)}
          >
            {visible && (
              <Animated.View
                entering={enteringAnimation}
                exiting={exitingAnimation}
                style={[styles.scrollBar]}
              >
                <Animated.View style={[styles.thumb, pointStyle]} />
              </Animated.View>
            )}
          </Animated.View>
        </PanGestureHandler>
      </>
    );
  }
);

export default React.memo(FastScrollIndicator);
