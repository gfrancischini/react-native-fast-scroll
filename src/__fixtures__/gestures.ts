import { DeviceEventEmitter } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

/**
 * The view the finger drags: the track of `FastScrollIndicator` or the strip of
 * the dots bar. Each carries a `testID` ending in `-track`, and its pan gesture
 * has the same test ID. These views render no text and have no role, so the
 * test ID is the only way to reach them (docs/unit-testing.md -> Gestures).
 */
export const getPanArea = () => screen.getByTestId(/-track$/);

/**
 * When a re-render hands `GestureDetector` a rebuilt gesture, it applies the new
 * callbacks on the next tick (`setImmediate`), which fake timers hold back. On a
 * device that tick always passes before the next touch, so every pan event
 * lets it pass first. Advancing by 0 ms fires nothing scheduled later.
 */
const applyPendingGestureUpdates = () => {
  act(() => jest.advanceTimersByTime(0));
};

/**
 * The callbacks of the pan gesture, as `GestureDetector` last applied them.
 * They are the worklets Reanimated receives on a device: a new object here
 * means the gesture was rebuilt and Reanimated got a new set, each holding the
 * JS functions it calls.
 */
export const getPanCallbacks = () => {
  applyPendingGestureUpdates();
  return getByGestureTestId(getPanArea().props.testID).handlers;
};

/** Gives the gesture area a size, as the native layout pass would. */
export const layoutPanArea = (height: number, width = 20) => {
  fireEvent(getPanArea(), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  });
};

/**
 * Sends one pan event the way RNGH delivers it from a device: a state change
 * (it carries `oldState`) or a move while active (it does not). RNGH's own
 * `fireGestureHandler` sends a whole gesture at once, from touch down to lift,
 * so a test could not hold the finger down in between. This uses the same
 * channel it does, one event at a time.
 */
const sendPanEvent = (event: { state: State; oldState?: State; y: number }) => {
  applyPendingGestureUpdates();
  const { testID } = getPanArea().props;
  const pan = getByGestureTestId(testID);
  const eventName =
    event.oldState === undefined
      ? 'onGestureHandlerEvent'
      : 'onGestureHandlerStateChange';
  act(() => {
    DeviceEventEmitter.emit(eventName, {
      handlerTag: pan.handlerTag,
      numberOfPointers: 1,
      x: 0,
      ...event,
    });
  });
};

export type Finger = {
  /** Moves the finger to `y`, activating the pan on the first move. */
  moveTo: (y: number) => void;
  /** Lifts the finger where it is: the pan ends, or fails if it never moved. */
  lift: () => void;
};

/**
 * Puts a finger on the gesture area at `y` (relative to the area) and returns
 * it, so a test can move it, hold it, and lift it.
 */
export const touchDown = (y: number): Finger => {
  let state: State = State.BEGAN;
  let lastY = y;
  sendPanEvent({ state: State.BEGAN, oldState: State.UNDETERMINED, y });

  return {
    moveTo(nextY) {
      sendPanEvent(
        state === State.BEGAN
          ? { state: State.ACTIVE, oldState: State.BEGAN, y: nextY }
          : { state: State.ACTIVE, y: nextY }
      );
      state = State.ACTIVE;
      lastY = nextY;
    },
    lift() {
      sendPanEvent(
        state === State.ACTIVE
          ? { state: State.END, oldState: State.ACTIVE, y: lastY }
          : { state: State.FAILED, oldState: State.BEGAN, y: lastY }
      );
    },
  };
};

/** A whole drag: touch down at the first `y`, move through the rest, lift. */
export const drag = (ys: [number, ...number[]]) => {
  const [first, ...rest] = ys;
  const finger = touchDown(first);
  rest.forEach((y) => finger.moveTo(y));
  finger.lift();
};
