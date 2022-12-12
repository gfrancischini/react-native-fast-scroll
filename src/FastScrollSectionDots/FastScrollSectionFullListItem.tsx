import type { SectionFullDataV2 } from '../types';

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
  item: SectionFullDataV2;

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
  index,
  item,
  isActive,
  scrollToIndex,
}: Props) {
  const finalText = useMemo(
    () =>
      typeof item.text === 'string' ? (
        `${index} - ${item.text}`
      ) : typeof item.text === 'function' ? (
        <item.text section={item} isActive={isActive} />
      ) : typeof item.text === 'object' ? (
        // TODO: Fix this typing of component
        //@ts-ignore
        <item.text section={item} isActive={isActive} />
      ) : (
        'Invalid'
      ),
    [index, isActive, item]
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
        },
      }),
    [isActive]
  );

  const onPress = useCallback(() => {
    scrollToIndex(item.startIndex);
  }, [item.startIndex, scrollToIndex]);

  return (
    <Pressable onPress={onPress}>
      <Text style={styles.text}>{finalText}</Text>
    </Pressable>
  );
}

export default React.memo(FastScrollSectionFullListItem);
