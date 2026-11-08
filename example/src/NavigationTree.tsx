import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { DebugScreen } from './Debug';
import type { RootStackParamList } from './screens';
import Categories from './category/Categories';
import { ExamplesScreen } from './ExamplesScreen';
import Performance from './performance/Performance';
import StaleCallback from './staleCallback/StaleCallback';

const Stack = createStackNavigator<RootStackParamList>();

const NavigationTree = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Group>
          <Stack.Screen name="Examples" component={ExamplesScreen} />
          <Stack.Screen name="Categories" component={Categories} />
          <Stack.Screen name="Performance" component={Performance} />
          <Stack.Screen name="StaleCallback" component={StaleCallback} />
        </Stack.Group>

        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen name="Debug" component={DebugScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default NavigationTree;
