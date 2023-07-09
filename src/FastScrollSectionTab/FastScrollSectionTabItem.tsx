import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import type { SectionFullData } from '../types';

type Props = {
  section: SectionFullData;
  isActive: boolean;
  tabBarItemStyle?: ViewStyle;
  tabBarItemTextStyle?: TextStyle;
  tabBarActiveItemStyle?: ViewStyle;
  tabBarActiveItemTextStyle?: TextStyle;
};

function FastScrollSectionTabItem({
  section,
  isActive,
  tabBarItemStyle,
  tabBarItemTextStyle,
  tabBarActiveItemStyle,
  tabBarActiveItemTextStyle,
}: Props) {
  const title =
    typeof section.text === 'string' ? (
      section.text
    ) : typeof section.text === 'function' ? (
      <section.text section={section} isActive={isActive} />
    ) : null;

  return (
    <View
      style={[
        styles.container,
        isActive ? styles.activeContainer : undefined,
        isActive ? tabBarActiveItemStyle : tabBarItemStyle,
      ]}
    >
      <Text
        style={[
          styles.text,
          isActive ? styles.activateText : undefined,
          isActive ? tabBarActiveItemTextStyle : tabBarItemTextStyle,
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  activeContainer: {
    borderBottomColor: 'black',
    borderBottomWidth: 1,
  },
  text: {
    padding: 14,
    color: 'gray',
    fontSize: 15,
  },
  activateText: {
    color: 'black',
  },
});

export default React.memo(FastScrollSectionTabItem);
