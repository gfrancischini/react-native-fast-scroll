import * as React from 'react';

import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DebugContext } from '../debug';

function Frame({ children }: React.PropsWithChildren) {
  const debugContext = React.useContext(DebugContext);
  if (debugContext.smallFrameEnabled) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.txtHeader}>Header</Text>
          <View style={styles.listContainer}>{children}</View>
          <Text style={styles.txtFooter}>Footer</Text>
        </View>
      </SafeAreaView>
    );
  }
  return <View>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'green',
  },
  container: {
    backgroundColor: 'blue',
    flex: 1,
  },
  listContainer: { flex: 2 },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
  viewContent: {
    paddingRight: 16,
    paddingLeft: 40,
    marginBottom: 24,
  },
  txtContent: {
    fontSize: 16,
    color: 'white',
  },
  txtFooter: {
    flex: 1,
    fontSize: 28,
    color: 'white',
    backgroundColor: 'orange',
    opacity: 0.5,
  },
  txtHeader: {
    flex: 1,
    fontSize: 28,
    color: 'white',
    backgroundColor: 'cyan',
    opacity: 0.5,
  },
});

export default React.memo(Frame);
