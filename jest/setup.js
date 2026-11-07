/* eslint-env jest */
// Runs before the test framework is installed (no `expect` yet).

// Mocks the native side of react-native-gesture-handler.
require('react-native-gesture-handler/jestSetup');

// Silences "useNativeDriver is not supported" warnings (e.g. from TouchableOpacity).
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Under Jest, react-native-reanimated runs its JS implementation and reads the
// frame clock from `global.ReanimatedDataMock`, which is normally only defined by
// its `withReanimatedTimer` helper. Back it with `Date.now()` so animations work
// with real timers and advance together with `jest.useFakeTimers()`.
global.ReanimatedDataMock = { now: () => Date.now() };
