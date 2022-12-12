import { useLayout } from '@react-native-community/hooks';

import React, { useCallback } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
  StyleSheet,
} from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import HeaderComp from './Header';

export const getCloser = (value: number, checkOne: number, checkTwo: number) =>
  Math.abs(value - checkOne) < Math.abs(value - checkTwo) ? checkOne : checkTwo;

type Props = React.PropsWithChildren<{
  scrollToOffset: (offset: number) => void;
  pinned?: boolean;
  headerHeight?: number | null;
}>;

type ComponentHandle = {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export const clamp = (
  value: number,
  lowerBound: number,
  upperBound: number
) => {
  return Math.min(Math.max(lowerBound, value), upperBound);
};

// This function is copy-pastable and it's the responsible of the 'airbnb' header effect.
const airbnbScrollHandler = (
  ev: NativeScrollEvent,
  animatedValueRef: Animated.SharedValue<number>,
  a: Animated.SharedValue<number>,
  MAX_HEIGHT: number
) => {
  'worklet';
  const { y } = ev.contentOffset;
  const diff = y - a.value;
  const newAnimatedValue = animatedValueRef.value + diff;

  if (y < ev.contentSize.height - ev.layoutMeasurement.height) {
    if (y > MAX_HEIGHT) {
      if (y < a.value) {
        animatedValueRef.value = Math.max(0, newAnimatedValue);
      } else {
        if (animatedValueRef.value < MAX_HEIGHT) {
          animatedValueRef.value = Math.min(MAX_HEIGHT, newAnimatedValue);
        } else {
          animatedValueRef.value = MAX_HEIGHT;
        }
      }
      a.value = Math.max(0, y);
    } else {
      if (a.value) {
        a.value = Math.max(0, y);
        animatedValueRef.value = Math.max(0, newAnimatedValue);
      } else {
        animatedValueRef.value = y;
      }
    }
  }
};

export const CollapsibleScrollableContainer = React.forwardRef(
  (
    { scrollToOffset, children, pinned = false, ...props }: Props,
    forwardedRef: React.ForwardedRef<ComponentHandle>
  ) => {
    const { onLayout, ...layout } = useLayout();
    //console.log('layout: ', layout);

    const headerHeight = props.headerHeight ?? layout.height ?? 0;
    //console.log('headerHeight', headerHeight);
    const animatedValue = useSharedValue(0);
    const backUpValue = useSharedValue(0);

    const translateHeaderStyle = useAnimatedStyle(() => {
      if (pinned) {
        return {
          transform: [{ translateY: 0 }],
        };
      }

      const maxHeight = withTiming(
        interpolate(
          animatedValue.value,
          [0, headerHeight],
          [0, -headerHeight],
          Extrapolate.CLAMP
        ),
        { duration: 10 }
      );

      return {
        transform: [{ translateY: maxHeight }],
      };
    }, [pinned, headerHeight]);

    const paddingContentStyle = useAnimatedStyle(() => {
      if (pinned) {
        return {
          paddingTop: headerHeight,
        };
      }

      const maxHeight = withTiming(
        interpolate(
          animatedValue.value,
          [0, headerHeight],
          [headerHeight, 0],
          Extrapolate.CLAMP
        ),
        { duration: 10 }
      );

      return {
        paddingTop: maxHeight,
      };
    }, [pinned, headerHeight]);

    const handleSnap = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      //console.log('handleSnap');
      const offsetY = event.nativeEvent.contentOffset.y; // - headerHeight;
      //   if (
      //     !(animatedValue.value === 0 || animatedValue.value === -headerHeight)
      //   ) {

      const currentAnimatedValue = Math.abs(animatedValue.value - headerHeight);

      const offset =
        getCloser(currentAnimatedValue, 0, headerHeight) === headerHeight
          ? offsetY - (headerHeight - animatedValue.value)
          : offsetY + (headerHeight + animatedValue.value);
      // console.log('animatedValue.value', {
      //   animated: animatedValue.value,
      //   offset,
      //   offsetY,
      //   currentAnimatedValue,
      //   getCloser: getCloser(currentAnimatedValue, 0, headerHeight),
      // });
      scrollToOffset(offset);
      //   }
    };

    const onScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        airbnbScrollHandler(
          event.nativeEvent,
          animatedValue,
          backUpValue,
          headerHeight
        );
      },
      [animatedValue, backUpValue, headerHeight]
    );

    React.useImperativeHandle(
      forwardedRef,
      (): ComponentHandle => ({
        onScroll,
        onScrollEnd: handleSnap,
      })
    );

    return (
      <View style={styles.container}>
        <Animated.View
          style={[styles.header, translateHeaderStyle]}
          onLayout={onLayout}
        >
          <HeaderComp />
        </Animated.View>
        <Animated.View style={[{ flex: 1 }, paddingContentStyle]}>
          {children}
        </Animated.View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  header: {
    position: 'absolute',
    backgroundColor: '#1c1c1c',
    // left: 0,
    //right: 0,
    width: '100%',
    //alignContent: 'c'
    zIndex: 1,
  },
});

export default CollapsibleScrollableContainer;
