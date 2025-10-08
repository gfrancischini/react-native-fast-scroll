import type { SectionFullData } from '../types';

import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

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
  const finalText = useMemo(
    () =>
      typeof item.text === 'string' ? (
        item.text
      ) : typeof item.text === 'function' ? (
        <item.text section={item} isActive={isActive} />
      ) : typeof item.text === 'object' ? (
        // TODO: Fix this typing of component
        //@ts-ignore
        <item.text section={item} isActive={isActive} />
      ) : (
        'Invalid'
      ),
    [isActive, item]
  );

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

  // Kleber: Using 'onPressIn' because of known issue from react-native flatlist
  // https://github.com/facebook/react-native/issues/51763
  return (
    <Pressable onPressIn={onPress}>
      <Text style={styles.text}>{finalText}</Text>
    </Pressable>
  );
}

export default React.memo(FastScrollSectionFullListItem);
