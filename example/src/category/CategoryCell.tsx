import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

import type { Product } from './data/categories';

interface ProductCellProps {
  product: Product;
  index: number;
}

const CategoryCell = ({ product, index }: ProductCellProps) => {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.firstName}>{`${index} - ${product.name}`} </Text>
      <Text style={styles.lastName}>{product.type}</Text>
      <Text style={styles.lastName}>{product.metal}</Text>
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

export default React.memo(CategoryCell);
