import type { SectionFullData } from '../types';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, ColorValue } from 'react-native';

import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { springConfig, useComponentSize } from '../utils';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { calculateYPosition, findSectionOnPosition } from './utils';
import { snapPoint } from 'react-native-redash';
import type { SectionDataWithDimensions } from '../types';

/**
 * Names the strip of dots the finger drags, both as the view's `testID` and as
 * the pan gesture's test ID, so tests can find and drive it.
 */
const DOTS_TRACK_TEST_ID = 'fast-scroll-section-dots-track';

const HIT_SLOP = { horizontal: 20 };

export type Props = {
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
   * Implement this method to scroll your list to the required index
   * @param index The index to scroll the list
   */
  onSectionChange: (section: SectionFullData) => void;

  /** A finger touches the dots: called before the first `onSectionChange`. */
  onFingerDown: () => void;

  /** The finger lifts off the dots: called after the last `onSectionChange`. */
  onFingerUp: () => void;

  sections: SectionFullData[];

  /**
   * The section the thumb starts on. The bar mounts each time it shows, so
   * without it the thumb would start above the first dot.
   */
  initialSectionIndex?: number;
};

/** Where the thumb sits when it rests on the dot of `sectionIndex`: its middle. */
const thumbYOnDot = (
  sectionIndex: number,
  dotSize: number,
  dotMargin: number
) => dotMargin * (sectionIndex + 1) + dotSize * sectionIndex + dotSize / 2;

export type FastScrollSectionDotsBarHandle = {
  /**
   * Call this method when viewable indicies changes
   * @param index The first visible index of the list
   */
  onSectionChange: (section: SectionFullData) => void;
};

const FastScrollSectionDotsBar = React.forwardRef(
  (
    {
      dotSize = 10,
      thumbScaleOnPress = 1.5,
      thumbColor = 'rgba(255, 255, 255, 0.8)',
      dotColor = 'white',
      scrollBarColor = 'rgba(65, 64, 66, 0.9)',
      dotMargin = 12,
      onSectionChange,
      onFingerDown,
      onFingerUp,
      initialSectionIndex,
      ...props
    }: Props,
    forwardedRef: React.ForwardedRef<FastScrollSectionDotsBarHandle>
  ) => {
    const scale = useSharedValue(1);
    const pointStylePositionY = useSharedValue(
      initialSectionIndex === undefined
        ? 0
        : thumbYOnDot(initialSectionIndex, dotSize, dotMargin)
    );
    const containerYOnPointStylePositionY = useSharedValue(0);

    const sections = useMemo((): SectionDataWithDimensions[] => {
      return props.sections.map((section, index) => {
        return {
          ...section,
          topOffset: dotMargin * (index + 1),
          y: dotMargin * (index + 1) + dotSize * index,
        };
      });
    }, [dotMargin, dotSize, props.sections]);

    /**
     * Height of the strip that holds every dot: a margin above each dot and one
     * below the last. The dots are shifted down with `top`, which does not grow
     * their parent, so the strip gets this height explicitly. The strip is
     * also the area the finger drags, so it must reach the last dot.
     */
    const stripHeight = sections.length * (dotSize + dotMargin) + dotMargin;

    /**
     * This is used to avoid noise coming from the list while the user is doing gestures
     * directly on the scrollbar
     */
    const enableExternalScrollEvents = useSharedValue(true);

    /**
     * The following lines are use to control the scrolling of the scroll bar as dots might
     * be out of view
     */
    const containerRef = useRef<React.ElementRef<typeof Animated.View>>(null);
    const { size, onLayout } = useComponentSize(containerRef);
    const containerScrollY = useDerivedValue(() => {
      if (!size) {
        return 0;
      }
      // calculate the current visible window
      const visibleWindowStartY =
        Math.abs(containerYOnPointStylePositionY.value) + dotSize + 5;
      const visibleWindowEndY =
        Math.abs(containerYOnPointStylePositionY.value) +
        size.height -
        dotSize +
        5;

      let newValue = 0;

      // check if the pointStylePositionY.value is out of the container view
      if (
        pointStylePositionY.value > visibleWindowEndY ||
        pointStylePositionY.value < visibleWindowStartY
      ) {
        newValue = size.height - pointStylePositionY.value - dotSize * 10;
      } else {
        newValue = containerYOnPointStylePositionY.value;
      }

      if (newValue > 0) {
        newValue = 0;
      }

      // Never scroll past the last dot: that would leave the bottom of the bar
      // empty and out of reach of the finger.
      const lowestScrollY = Math.min(0, size.height - stripHeight);
      if (newValue < lowestScrollY) {
        newValue = lowestScrollY;
      }

      return newValue;
    }, [dotSize, dotMargin, size, pointStylePositionY, stripHeight]);

    const containerScrollStyle = useAnimatedStyle(() => {
      return {
        transform: [
          {
            translateY: withSpring(containerScrollY.value, springConfig),
          },
        ],
      };
    });

    // The pan gesture below calls JS functions through runOnJS, and on
    // a device Reanimated holds every function a worklet calls, and a copy of
    // every value it reads, from native code. So the pan is built once and
    // captures no app data: the functions read the sections and the callbacks
    // through refs, and the worklets read only the dots' positions, from a
    // shared value. Rebuilt on each render, it kept each render of the app's
    // screen alive through the sections and callbacks it closed over.
    const sectionsRef = useRef(sections);
    sectionsRef.current = sections;
    const onSectionChangeRef = useRef(onSectionChange);
    onSectionChangeRef.current = onSectionChange;

    const onFingerDownRef = useRef(onFingerDown);
    onFingerDownRef.current = onFingerDown;
    const onFingerUpRef = useRef(onFingerUp);
    onFingerUpRef.current = onFingerUp;

    const onThumbPositionChange = useCallback((positionY: number) => {
      const section = findSectionOnPosition(positionY, sectionsRef.current);
      if (section) {
        onSectionChangeRef.current(section);
      }
    }, []);
    const fingerDown = useCallback(() => onFingerDownRef.current(), []);
    const fingerUp = useCallback(() => onFingerUpRef.current(), []);

    const dotPositions = useMemo(
      () => sections.map(({ sectionIndex, y }) => ({ sectionIndex, y })),
      [sections]
    );
    const dotPositionsValue = useSharedValue(dotPositions);
    useEffect(() => {
      dotPositionsValue.value = dotPositions;
    }, [dotPositions, dotPositionsValue]);

    const pan = useMemo(() => {
      /** The thumb follows the finger while it is down. */
      const followFinger = (y: number) => {
        'worklet';
        const { yPosition } = calculateYPosition({
          y,
          dotMargin,
          dotSize,
          sections: dotPositionsValue.value,
        });
        pointStylePositionY.value = yPosition;
        containerYOnPointStylePositionY.value = containerScrollY.value;

        runOnJS(onThumbPositionChange)(pointStylePositionY.value);
      };

      return (
        Gesture.Pan()
          .hitSlop(HIT_SLOP)
          .withTestId(DOTS_TRACK_TEST_ID)
          // The finger touches the bar
          .onBegin((event) => {
            // when the user start a gesture we avoid noise coming from the list
            enableExternalScrollEvents.value = false;
            scale.value = thumbScaleOnPress;
            runOnJS(fingerDown)();
            followFinger(event.y);
          })
          // The finger has moved far enough to activate the pan, then moves on
          .onStart((event) => followFinger(event.y))
          .onUpdate((event) => followFinger(event.y))
          // The finger lifts, whether the pan activated (a drag) or not (a tap)
          .onFinalize((event) => {
            // when the user finishes a gesture we allow receiving events from the list
            enableExternalScrollEvents.value = true;
            const { yPosition } = calculateYPosition({
              y: event.y,
              dotMargin,
              dotSize,
              sections: dotPositionsValue.value,
            });
            pointStylePositionY.value = yPosition;
            const snapPoints = dotPositionsValue.value.map((dot) => dot.y);
            const newTranslate = snapPoint(yPosition, 0, snapPoints);
            pointStylePositionY.value = newTranslate + dotSize / 2;
            containerYOnPointStylePositionY.value = containerScrollY.value;
            scale.value = 1;

            runOnJS(onThumbPositionChange)(pointStylePositionY.value);
            runOnJS(fingerUp)();
          })
      );
    }, [
      containerScrollY,
      containerYOnPointStylePositionY,
      dotMargin,
      dotPositionsValue,
      dotSize,
      enableExternalScrollEvents,
      fingerDown,
      fingerUp,
      onThumbPositionChange,
      pointStylePositionY,
      scale,
      thumbScaleOnPress,
    ]);

    // Animation related to the thumb marker
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
      (): FastScrollSectionDotsBarHandle => ({
        onSectionChange: (section: SectionFullData) => {
          if (enableExternalScrollEvents.value) {
            pointStylePositionY.value = thumbYOnDot(
              section.sectionIndex,
              dotSize,
              dotMargin
            );
            containerYOnPointStylePositionY.value = containerScrollY.value;
          }
        },
      })
    );

    const styles = useMemo(
      () =>
        StyleSheet.create({
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
            // As tall as all the dots, but never taller than the space the app
            // gives the dots: when they do not fit, the strip scrolls inside.
            flexShrink: 1,
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
        }),
      [dotColor, dotSize, scrollBarColor, thumbColor]
    );

    return (
      <Animated.View
        onLayout={onLayout}
        ref={containerRef}
        style={[styles.scrollBar]}
      >
        <GestureDetector gesture={pan}>
          <Animated.View
            collapsable={false}
            style={[{ height: stripHeight }, containerScrollStyle]}
            testID={DOTS_TRACK_TEST_ID}
          >
            {sections.map((section, index) => {
              return (
                <Animated.View
                  collapsable={false}
                  key={index}
                  style={[
                    styles.dot,
                    {
                      top: section.topOffset,
                      backgroundColor:
                        section.dotColor ?? styles.dot.backgroundColor,
                    },
                  ]}
                />
              );
            })}
            <Animated.View style={[styles.thumb, pointStyle]} />
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    );
  }
);

export default React.memo(FastScrollSectionDotsBar);
