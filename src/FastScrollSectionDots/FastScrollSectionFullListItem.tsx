import type { SectionFullData } from '../types';

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/** How far (px) the finger may move before a touch on a row stops being a tap. */
const TAP_MAX_DISTANCE = 10;

type Props = {
  /**
   * The current index
   */
  index: number;

  /**
   * The current section being rendered
   */
  item: SectionFullData;

  /**
   * If this item is the active one
   */
  isActive: boolean;

  /**
   * Callback called when a scroll to specific index is required
   */
  scrollToIndex: (index: number) => void;
};

function FastScrollSectionFullListItem({
  item,
  isActive,
  scrollToIndex,
}: Props) {
  const finalText = useMemo(() => {
    const { text: SectionText } = item;
    if (typeof SectionText === 'string') {
      return SectionText;
    }
    // A component is a function, or an object for `React.memo` / `forwardRef`
    if (
      typeof SectionText === 'function' ||
      (typeof SectionText === 'object' && SectionText !== null)
    ) {
      return <SectionText section={item} isActive={isActive} />;
    }
    return 'Invalid';
  }, [isActive, item]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        text: {
          borderRadius: 100,
          fontSize: 16,
          paddingHorizontal: 16,
          paddingVertical: 7,
          color: isActive ? '#262626' : 'white',
          backgroundColor: isActive ? 'white' : undefined,
          fontWeight: '600',
        },
      }),
    [isActive]
  );

  const onPress = useCallback(() => {
    scrollToIndex(item.startIndex);
  }, [item.startIndex, scrollToIndex]);

  // A gesture-handler tap instead of a `Pressable`: on newer React Native the
  // `Pressable`'s `onPress` can stop firing inside a scrolled list
  // (https://github.com/facebook/react-native/issues/51763), and `onPressIn`
  // fires on touch down, so touching the list to scroll it picked a row. The
  // tap fires when the finger lifts and fails once the finger moves or the
  // list takes the touch over to scroll.
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .maxDistance(TAP_MAX_DISTANCE)
        .withTestId(`fast-scroll-section-list-row-${item.sectionIndex}`)
        .onEnd((_event, success) => {
          if (success) {
            onPress();
          }
        }),
    [item.sectionIndex, onPress]
  );

  // The detector attaches to its child's native view. On the New Architecture
  // a `Text` does not get one of its own (it can be flattened into its
  // parent), so Gesture Handler logs an error for every row; a view that
  // cannot be collapsed always has one.
  return (
    <GestureDetector gesture={tap}>
      <View collapsable={false}>
        <Text accessibilityRole="button" style={styles.text}>
          {finalText}
        </Text>
      </View>
    </GestureDetector>
  );
}

export default React.memo(FastScrollSectionFullListItem);
