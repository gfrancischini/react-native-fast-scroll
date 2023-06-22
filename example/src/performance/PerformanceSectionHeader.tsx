import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import type { HeaderItem } from './data';

interface MultiCategoryHeaderProps {
  header: HeaderItem;
}

const PerformanceSectionHeader = ({ header }: MultiCategoryHeaderProps) => {
  return (
    <View style={styles.header}>
      <Text
        style={styles.headerTitle}
      >{`${header.category1} / ${header.category2} `}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  headerTitle: {
    paddingLeft: 10,
    paddingVertical: 4,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  header: {
    backgroundColor: 'darkred',
  },
});

export default React.memo(PerformanceSectionHeader);
