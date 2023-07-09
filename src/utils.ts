import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { Section, SectionFullData } from './types';

export const springConfig = {
  stiffness: 1000,
  damping: 500,
  mass: 3,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

export const timingConfig = {
  duration: 400,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

export const findNearestActiveSection = <T extends { index: number }>(
  sections: T[],
  activeIndex: number
) => {
  const reversedSections = [...sections].reverse();
  const currentSection = reversedSections.find(
    (section) => activeIndex >= section.index
  );
  return currentSection!;
};

export type ComponentSize = {
  height: number;
  width: number;
  x: number;
  y: number;
  pageX?: number;
  pageY?: number;
};

export const useComponentSize = (
  ref?: React.MutableRefObject<View | Animated.View | undefined | null>
) => {
  const [size, setSize] = useState<ComponentSize | null>(null);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (ref?.current) {
        ref.current.measure(
          (
            x: number,
            y: number,
            width: number,
            height: number,
            pageX: number,
            pageY: number
          ) => {
            setSize({ x, y, width, height, pageX, pageY });
          }
        );
        return;
      }
      const { width, height, x, y } = event.nativeEvent.layout;
      setSize({ width, height, x, y });
    },
    [ref]
  );

  return { size, onLayout };
};

export const useHideFlatBar = ({
  hideFastScrollIndicatorTimeout = 1000,
  barWidth,
}: {
  hideFastScrollIndicatorTimeout?: number;
  barWidth: number;
}) => {
  const translateFastScrollBarX = useSharedValue(
    hideFastScrollIndicatorTimeout === 0 ? 0 : -barWidth
  );
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const translateFastScrollBarXTimer = useRef<NodeJS.Timeout | null>(null);
  const lockedStatus = useRef<boolean>(false);
  const clearTimeoutFastScrollBar = useCallback(() => {
    if (translateFastScrollBarXTimer.current != null) {
      clearTimeout(translateFastScrollBarXTimer.current);
      translateFastScrollBarXTimer.current = null;
    }
  }, []);

  const scheduleHideFastScrollbar = useCallback(() => {
    clearTimeoutFastScrollBar();
    if (hideFastScrollIndicatorTimeout === 0 || lockedStatus.current === true) {
      // we dont hide the scroll indicator when the value is zero
      return;
    }

    translateFastScrollBarXTimer.current = setTimeout(() => {
      translateFastScrollBarX.value = withSpring(-barWidth, springConfig);
      translateFastScrollBarXTimer.current = null;
      setVisible(false);
      visibleRef.current = false;
    }, hideFastScrollIndicatorTimeout);
  }, [
    barWidth,
    clearTimeoutFastScrollBar,
    hideFastScrollIndicatorTimeout,
    translateFastScrollBarX,
  ]);

  const showFastScrollBar = useCallback(() => {
    scheduleHideFastScrollbar();
    if (visibleRef.current) {
      // already visible
      return;
    }
    translateFastScrollBarX.value = withSpring(0, springConfig);
    setVisible(true);
    visibleRef.current = true;
  }, [scheduleHideFastScrollbar, translateFastScrollBarX]);

  const lockScrollBarVisibility = useCallback(
    (_visible: boolean) => {
      lockedStatus.current = _visible;
      if (_visible) {
        showFastScrollBar();
      } else {
        scheduleHideFastScrollbar();
      }
    },
    [scheduleHideFastScrollbar, showFastScrollBar]
  );

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

  return {
    translateFastScrollBarX,
    clearTimeoutFastScrollBar,
    scheduleHideFastScrollbar,
    showFastScrollBar,
    visible,
    lockScrollBarVisibility,
  };
};

export const useTimer = ({
  callbackTimeout,
  callbackSchedule,
  timeout = 1000,
}: {
  callbackTimeout: () => void;
  callbackSchedule: () => void;
  timeout?: number;
}) => {
  const translateFastScrollBarXTimer = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (translateFastScrollBarXTimer.current != null) {
      clearTimeout(translateFastScrollBarXTimer.current);
      translateFastScrollBarXTimer.current = null;
    }
  }, []);

  const scheduleTimer = useCallback(() => {
    if (timeout === 0) {
      // we dont hide the scroll indicator when the value is zero
      return;
    }

    clearTimer();
    translateFastScrollBarXTimer.current = setTimeout(() => {
      translateFastScrollBarXTimer.current = null;
      callbackTimeout();
    }, timeout);
  }, [callbackTimeout, clearTimer, timeout]);

  const startTimer = useCallback(() => {
    callbackSchedule();
    scheduleTimer();
  }, [callbackSchedule, scheduleTimer]);

  useEffect(() => {
    // dealing with prop change. if timeout is 0 means we should always show the fast scroll indicator
    if (timeout === 0) {
      startTimer();
    }
  }, [scheduleTimer, startTimer, timeout]);

  return [startTimer, clearTimer, scheduleTimer] as const;
};

export const createFullSectionData = ({
  stickyHeaderIndicesWithData,
  stickyHeaderIndices,
}: {
  stickyHeaderIndicesWithData?: Section[];
  stickyHeaderIndices?: number[];
}): SectionFullData[] => {
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
};
