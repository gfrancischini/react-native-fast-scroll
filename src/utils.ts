import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export const Alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

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
      const size = event.nativeEvent.layout;
      const { width, height, x, y } = size;
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

      setSize({ width, height, x, y });
    },
    [ref]
  );

  return { size, onLayout };
};

export const useNearestActiveSession = <T extends { index: number }>(
  sections: T[]
) => {
  const currentIgnoreVisibleItemForRef = useRef<NodeJS.Timeout | null>();
  const ignoreVisibleItems = useRef<boolean>(false);
  const activeIndex = useRef<number>(0);

  const [nearestActiveSection, setNearestActiveSection] = useState<T | null>(
    findNearestActiveSection(sections, activeIndex.current) ?? sections[0]
  );

  const setActiveIndex = useCallback(
    (index: number) => {
      activeIndex.current = index;

      if (!ignoreVisibleItems.current) {
        const _nearestActiveSection = findNearestActiveSection(
          sections,
          activeIndex.current
        );
        setNearestActiveSection(_nearestActiveSection);
        return _nearestActiveSection;
      }
      return null;
    },
    [sections]
  );

  const ignoreVisibleItemsFor = useCallback(
    (goodActiveIndex: number, ms = 1500) => {
      setNearestActiveSection(
        findNearestActiveSection(sections, goodActiveIndex)
      );
      if (currentIgnoreVisibleItemForRef.current != null) {
        clearTimeout(currentIgnoreVisibleItemForRef.current);
      }
      ignoreVisibleItems.current = true;
      currentIgnoreVisibleItemForRef.current = setTimeout(() => {
        currentIgnoreVisibleItemForRef.current = null;
        ignoreVisibleItems.current = false;
      }, ms);
    },
    [sections]
  );
  return {
    nearestActiveSection,
    ignoreVisibleItemsFor,
    setActiveIndex,
  };
};

export const useHideFlatBar = ({
  hideFastScrollIndicatorTimeout = 1000,
  barWidth,
}: {
  hideFastScrollIndicatorTimeout: number;
  barWidth: number;
}) => {
  const translateFastScrollBarX = useSharedValue(
    hideFastScrollIndicatorTimeout === 0 ? 0 : -barWidth
  );
  const translateFastScrollBarXTimer = useRef<NodeJS.Timeout | null>(null);

  const clearTimeoutFastScrollBar = useCallback(() => {
    if (translateFastScrollBarXTimer.current != null) {
      clearTimeout(translateFastScrollBarXTimer.current);
      translateFastScrollBarXTimer.current = null;
    }
  }, []);

  const scheduleHideFastScrollbar = useCallback(() => {
    if (hideFastScrollIndicatorTimeout === 0) {
      // we dont hide the scroll indicator when the value is zero
      return;
    }
    clearTimeoutFastScrollBar();
    translateFastScrollBarXTimer.current = setTimeout(() => {
      translateFastScrollBarX.value = withSpring(-barWidth, springConfig);
      translateFastScrollBarXTimer.current = null;
    }, hideFastScrollIndicatorTimeout);
  }, [
    barWidth,
    clearTimeoutFastScrollBar,
    hideFastScrollIndicatorTimeout,
    translateFastScrollBarX,
  ]);

  const showFastScrollBar = useCallback(() => {
    translateFastScrollBarX.value = withSpring(0, springConfig);
    scheduleHideFastScrollbar();
  }, [scheduleHideFastScrollbar, translateFastScrollBarX]);

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
