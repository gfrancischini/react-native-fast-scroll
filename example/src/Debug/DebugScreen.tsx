import React, { useContext } from 'react';
import { View, Text, StyleSheet, Switch, TextInput } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { DebugContext, DebugContextInterface } from './DebugContext';
import { getDebugItems, DebugItem, DebugOptionType } from './DebugOptions';

const DebugScreen = () => {
  const debugContext = useContext<DebugContextInterface>(DebugContext);
  const debugItems = getDebugItems(debugContext);

  const renderItem = ({ item }: { item: DebugItem }) => {
    return (
      <View style={styles.row}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        {renderInput(item)}
      </View>
    );
  };

  return (
    <FlashList
      keyExtractor={(item: DebugItem) => {
        return item.name;
      }}
      renderItem={renderItem}
      estimatedItemSize={44}
      ItemSeparatorComponent={Divider}
      data={debugItems}
    />
  );
};

const Divider = () => {
  return <View style={styles.divider} />;
};

const renderInput = (item: DebugItem) => {
  if (item.type === DebugOptionType.Switch) {
    return (
      <Switch
        onValueChange={(value) => {
          item.onValue(value);
        }}
        value={item.value}
        testID={item.testID}
      />
    );
  } else if (item.type === DebugOptionType.Input) {
    return (
      <TextInput
        onChangeText={(value) => {
          item.onValue(Number(value));
        }}
        placeholder="Set value"
        value={item.value?.toString()}
        keyboardType="number-pad"
      />
    );
  }
  return null;
};

export default DebugScreen;

const styles = StyleSheet.create({
  row: {
    flex: 1,
    backgroundColor: '#FFF',
    height: 44,
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 18,
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#DDD',
  },
});
