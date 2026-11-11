import { act } from '@testing-library/react-native';

type Reanimated = typeof import('react-native-reanimated');

/** The runOnJS calls waiting for the JS thread, while it is busy. */
let waitingCalls: (() => void)[] | null = null;

/**
 * On a device a pan's worklets run on the UI thread, and `runOnJS(fn)(...)` does
 * not call `fn`: it puts the call in line on the JS thread, behind the work
 * already waiting there, such as the list's scroll events. Under Jest both
 * threads are one and `runOnJS` calls `fn` at once, so that wait never happens.
 *
 * This is Reanimated with a `runOnJS` that can wait. A suite opts in at the top
 * of its file:
 *
 * ```ts
 * jest.mock('react-native-reanimated', () =>
 *   require('../../__fixtures__/jsThread').reanimatedWithJsThread()
 * );
 * ```
 *
 * Everything else is the real Reanimated, and `runOnJS` still calls `fn` at
 * once outside `whileJsThreadIsBusy`.
 */
export const reanimatedWithJsThread = (): Reanimated => {
  const actual = jest.requireActual<Reanimated>('react-native-reanimated');
  const runOnJS = ((fn: Parameters<Reanimated['runOnJS']>[0]) => {
    const call = actual.runOnJS(fn) as (...args: unknown[]) => void;
    return (...args: unknown[]) => {
      if (waitingCalls) {
        waitingCalls.push(() => call(...args));
      } else {
        call(...args);
      }
    };
  }) as Reanimated['runOnJS'];
  return { ...actual, runOnJS, __esModule: true } as Reanimated;
};

/**
 * Runs `work` while the JS thread is busy: the calls worklets make with
 * `runOnJS` meanwhile wait in line, so what `work` itself does on the JS thread
 * (calling a handle, as an app does from a list event that was already in
 * line) runs before them. Then the JS thread catches up and runs them in
 * order. Needs `reanimatedWithJsThread`.
 */
export const whileJsThreadIsBusy = (work: () => void) => {
  const calls: (() => void)[] = [];
  waitingCalls = calls;
  try {
    work();
  } finally {
    waitingCalls = null;
  }
  act(() => calls.forEach((call) => call()));
};
