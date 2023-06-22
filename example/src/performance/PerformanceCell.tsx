import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

import type { RowItem } from './data';

interface PerformanceCellProps {
  item: RowItem;
  index: number;
}

const PerformanceCell = ({ item, index }: PerformanceCellProps) => {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.firstName}>{`${index} - ${item.title}`} </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'column',
    backgroundColor: 'white',
    padding: 2,
  },
  firstName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  lastName: {
    fontSize: 18,
  },
});

export default React.memo(PerformanceCell);
