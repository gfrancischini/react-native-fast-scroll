import type { SectionFullData } from '../types';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, ColorValue } from 'react-native';

import Animated, {
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { springConfig, useComponentSize } from '../utils';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { calculateYPosition, findSectionOnPosition } from './utils';
import { snapPoint } from 'react-native-redash';
import type { SectionDataWithDimensions } from '../types';

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

  sections: SectionFullData[];

  /**
   * The side that the thumbSize will grow
   * @default right
   */
  side?: 'left' | 'right';
};

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
      side,
      onSectionChange,
      ...props
    }: Props,
    forwardedRef: React.ForwardedRef<FastScrollSectionDotsBarHandle>
  ) => {
    const scale = useSharedValue(1);
    const pointStylePositionY = useSharedValue(0);
    const containerYOnPointStylePositionY = useSharedValue(0);

    const sections = useMemo((): SectionDataWithDimensions[] => {
      return props.sections.map((section, index) => {
        return {
          ...section,
          top: dotMargin * (index + 1),
          end: dotMargin * (index + 1) + dotSize,
          center: dotMargin * (index + 1) + dotSize * index,
        };
      });
    }, [dotMargin, dotSize, props.sections]);

    useEffect(() => {}, []);

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

      //  console.log('visiblewindow', { visibleWindowEndY, visibleWindowStartY });
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

      return newValue;
    }, [dotSize, dotMargin, size, pointStylePositionY]);

    const containerScrollStyle = useAnimatedStyle(() => {
      return {
        transform: [
          {
            translateY: withSpring(containerScrollY.value, springConfig),
          },
        ],
      };
    });

    const onThumbPositionChange = useCallback(
      (positionY: number) => {
        const section = findSectionOnPosition(positionY, sections);
        if (section) {
          onSectionChange(section);
        }
      },
      [onSectionChange, sections]
    );

    const onGestureEvent = useAnimatedGestureHandler<
      PanGestureHandlerGestureEvent,
      { y: number }
    >({
      onStart: (event) => {
        // when the user start a gesture we avoid noise coming from the list
        enableExternalScrollEvents.value = false;

        const { yPosition } = calculateYPosition({
          y: event.y,
          dotMargin,
          dotSize,
          sections,
        });
        pointStylePositionY.value = yPosition;
        containerYOnPointStylePositionY.value = containerScrollY.value;

        scale.value = thumbScaleOnPress;

        runOnJS(onThumbPositionChange)(pointStylePositionY.value);
      },
      onActive: (event) => {
        const { yPosition } = calculateYPosition({
          y: event.y,
          dotMargin,
          dotSize,
          sections,
        });
        pointStylePositionY.value = yPosition;
        containerYOnPointStylePositionY.value = containerScrollY.value;

        runOnJS(onThumbPositionChange)(pointStylePositionY.value);
      },
      onFinish: (event) => {
        // when the user finishes a gesture we allow receiving events from the list
        enableExternalScrollEvents.value = true;
        const { yPosition } = calculateYPosition({
          y: event.y,
          dotMargin,
          dotSize,
          sections,
        });
        pointStylePositionY.value = yPosition;
        const snapPoints = sections.map((section) => section.center);
        const newTranslate = snapPoint(yPosition, 0, snapPoints);
        pointStylePositionY.value = newTranslate + dotSize / 2;
        containerYOnPointStylePositionY.value = containerScrollY.value;
        scale.value = 1;

        runOnJS(onThumbPositionChange)(pointStylePositionY.value);
      },
    });

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
            pointStylePositionY.value =
              dotMargin * (section.sectionIndex + 1) +
              dotSize * section.sectionIndex +
              dotSize / 2;
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
        }),
      [dotColor, dotSize, scrollBarColor, thumbColor]
    );

    const hitSlop = useMemo(() => {
      if (side === 'left') {
        return { horizontal: 20 };
      } else {
        return { horizontal: 20 };
      }
    }, [side]);

    return (
      <Animated.View
        onLayout={onLayout}
        ref={containerRef}
        style={[styles.scrollBar]}
      >
        <PanGestureHandler hitSlop={hitSlop} onGestureEvent={onGestureEvent}>
          <Animated.View collapsable={false} style={containerScrollStyle}>
            {sections.map((section, index) => {
              return (
                <Animated.View
                  collapsable={false}
                  key={index}
                  style={[
                    styles.dot,
                    {
                      top: section.top,
                      backgroundColor:
                        section.dotColor ?? styles.dot.backgroundColor,
                    },
                  ]}
                />
              );
            })}
            <Animated.View style={[styles.thumb, pointStyle]} />
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    );
  }
);

export default React.memo(FastScrollSectionDotsBar);
