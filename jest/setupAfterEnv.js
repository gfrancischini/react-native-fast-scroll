/* eslint-env jest */
// Runs after the test framework is installed (`expect` is available).

// react-native-reanimated automatically falls back to its JS implementation
// under Jest. Its `setUpTests()` helper is NOT used because in 2.12 it calls
// `require('expect').extend`, which does not exist on Jest >= 28. The only other
// thing it does is load this polyfill. To read an animated style, see
// `src/__fixtures__/positions.ts`.
require('setimmediate');

// Adds React Native Testing Library matchers (toBeVisible, toHaveTextContent, ...).
require('@testing-library/react-native/extend-expect');

// Loading RNTL here registers its auto-cleanup (unmount) first, so it runs
// before the hook below.
const { act } = require('@testing-library/react-native');

// Suites turn fake timers on in `beforeEach`; this turns them off.
//
// Reanimated requests one frame at a time and waits for it before requesting
// the next; RN's Jest setup runs frames on `setTimeout`. A frame still pending
// on the fake clock when the timers are swapped is dropped, Reanimated keeps
// waiting for it, and every animated style freezes for the rest of the file.
// So run everything pending first, including animations that are still
// running (each frame requests the next).
afterEach(() => {
  const fakeTimersInstalled = setTimeout.clock !== undefined;
  if (fakeTimersInstalled) {
    act(() => jest.runAllTimers());
  }
  jest.useRealTimers();
});
