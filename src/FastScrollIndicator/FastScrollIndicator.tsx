import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { StyleSheet, ColorValue, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  runOnUI,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { springConfig } from '../utils';

/**
 * Names the track the finger drags, both as the view's `testID` and as the pan
 * gesture's test ID, so tests can find and drive it.
 */
const INDICATOR_TRACK_TEST_ID = 'fast-scroll-indicator-track';

const HIT_SLOP = { horizontal: 20 };

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
   * @param offsetPercentage between 0 and 1. Values outside it, such as the
   * ones an iOS list reports while it bounces, keep the thumb at that end.
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
    const viewLayout = useSharedValue({ x: 0, y: 0, height: 0, width: 0 });

    // While a finger is on the track it leads, and the list's reports through
    // onScrollToOffsetPercentage are ignored. Those reports trail the finger
    // at both ends of the touch, so the pan keeps two copies of the flag:
    // - On the UI thread, set the moment the finger lands. The handle sends
    //   the thumb's new position there and the check runs there, so a report
    //   that was already in line on the JS thread when the finger landed can
    //   no longer pull the thumb from under it.
    // - On the JS thread, set through runOnJS, behind the list's scroll events
    //   already in line there. The handle checks it first: when the finger
    //   lifts, those events report where the finger was a few frames before.
    //   It also keeps them from restarting the hide timer under the finger.
    // The handle never reads a shared value: apps call it on every scroll
    // frame, and on Reanimated 3 that read blocks the JS thread until the UI
    // thread answers.
    const fingerOnTrackOnUI = useSharedValue(false);
    const fingerOnTrack = useRef(false);
    const setFingerOnTrack = useCallback((isOnTrack: boolean) => {
      fingerOnTrack.current = isOnTrack;
    }, []);
    const onTrackLayout = useCallback(
      (event: LayoutChangeEvent) => {
        viewLayout.value = event.nativeEvent.layout;
      },
      [viewLayout]
    );

    const clearTimeoutFastScrollBar = useCallback(() => {
      if (translateFastScrollBarXTimer.current != null) {
        clearTimeout(translateFastScrollBarXTimer.current);
        translateFastScrollBarXTimer.current = null;
      }
    }, []);

    // The pan gesture below calls JS functions through runOnJS, and on a device
    // Reanimated holds every function a worklet calls from native code. Those
    // functions read the props through refs, so they never change and the pan
    // is built once: rebuilt on each render, it kept each render of the app's
    // screen alive through the callbacks it closed over.
    const scrollToOffsetPercentageRef = useRef(scrollToOffsetPercentage);
    scrollToOffsetPercentageRef.current = scrollToOffsetPercentage;
    const hideFastScrollIndicatorTimeoutRef = useRef(
      hideFastScrollIndicatorTimeout
    );
    hideFastScrollIndicatorTimeoutRef.current = hideFastScrollIndicatorTimeout;

    const scheduleHideFastScrollbar = useCallback(() => {
      const timeout = hideFastScrollIndicatorTimeoutRef.current;
      if (timeout === 0) {
        // we dont hide the scroll indicator when the value is zero
        return;
      }
      clearTimeoutFastScrollBar();
      translateFastScrollBarXTimer.current = setTimeout(() => {
        translateFastScrollBarXTimer.current = null;
        setVisible(false);
      }, timeout);
    }, [clearTimeoutFastScrollBar]);

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

    // A screen can close while the bar waits to hide.
    useEffect(() => clearTimeoutFastScrollBar, [clearTimeoutFastScrollBar]);

    const processScrollJSThread = useCallback((offsetPercentage: number) => {
      scrollToOffsetPercentageRef.current(offsetPercentage);
    }, []);

    const thumbHeight = thumbSize.height;

    const pan = useMemo(() => {
      const processScroll = (offsetPercentage: number) => {
        'worklet';
        runOnJS(processScrollJSThread)(offsetPercentage);
      };

      const calculateYPosition = (y: number) => {
        'worklet';
        const minHeight = thumbHeight / 2;
        const maxHeight = viewLayout.value.height - thumbHeight / 2;
        const yPosition =
          y < minHeight ? minHeight : y > maxHeight ? maxHeight : y;
        const yPercentage = (yPosition - minHeight) / (maxHeight - minHeight);
        return { yPosition: yPosition - thumbHeight / 2, yPercentage };
      };

      /** The thumb follows the finger, and the list follows the thumb. */
      const followFinger = (y: number) => {
        'worklet';
        const { yPosition, yPercentage } = calculateYPosition(y);
        translateY.value = yPosition;
        processScroll(yPercentage);
        runOnJS(clearTimeoutFastScrollBar)();
      };

      return (
        Gesture.Pan()
          .hitSlop(HIT_SLOP)
          .withTestId(INDICATOR_TRACK_TEST_ID)
          // The finger touches the track
          .onBegin((event) => {
            scale.value = thumbScaleOnPress;
            // Before the list scrolls: its reports are ignored from now on.
            fingerOnTrackOnUI.value = true;
            runOnJS(setFingerOnTrack)(true);
            followFinger(event.y);
          })
          // The finger has moved far enough to activate the pan, then moves on
          .onStart((event) => followFinger(event.y))
          .onUpdate((event) => followFinger(event.y))
          // The finger lifts, whether the pan activated (a drag) or not (a tap)
          .onFinalize((event) => {
            const { yPosition, yPercentage } = calculateYPosition(event.y);
            processScroll(yPercentage);
            translateY.value = yPosition;
            scale.value = 1;
            fingerOnTrackOnUI.value = false;
            runOnJS(setFingerOnTrack)(false);
            runOnJS(scheduleHideFastScrollbar)();
          })
      );
    }, [
      clearTimeoutFastScrollBar,
      fingerOnTrackOnUI,
      processScrollJSThread,
      scale,
      scheduleHideFastScrollbar,
      setFingerOnTrack,
      thumbHeight,
      thumbScaleOnPress,
      translateY,
      viewLayout,
    ]);

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

    /** Moves the thumb to where the list is, unless a finger is on the track. */
    const followListOnUI = useMemo(
      () =>
        runOnUI((offsetPercentage: number) => {
          'worklet';
          if (fingerOnTrackOnUI.value) {
            return;
          }
          translateY.value =
            offsetPercentage * (viewLayout.value.height - thumbHeight);
        }),
      [fingerOnTrackOnUI, thumbHeight, translateY, viewLayout]
    );

    React.useImperativeHandle(
      forwardedRef,
      (): FastScrollIndicatorHandle => ({
        onScrollToOffsetPercentage(offsetPercentage: number) {
          if (fingerOnTrack.current) {
            // event is ignored as the scrolling is being done by the thumbs
            return;
          }

          // A list that bounces past either end (iOS) reports offsets below 0
          // and above 1, and can come to rest just past 1. The thumb stays at
          // that end of the track.
          followListOnUI(Math.min(1, Math.max(0, offsetPercentage)));

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
        <GestureDetector gesture={pan}>
          <Animated.View
            style={styles.container}
            testID={INDICATOR_TRACK_TEST_ID}
            onLayout={onTrackLayout}
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
        </GestureDetector>
      </>
    );
  }
);

export default React.memo(FastScrollIndicator);
