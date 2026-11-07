import { act, fireEvent, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';

/**
 * The view wrapped by the component's `PanGestureHandler`. Under Jest the
 * handler hands its child `handlerType`/`handlerTag` props, and the components
 * expose no `testID`, so this is the documented `UNSAFE_*` exception
 * (docs/unit-testing.md -> Gestures).
 */
export const getPanHandler = () => {
  const [handler] = screen.UNSAFE_getAllByProps({
    handlerType: 'PanGestureHandler',
  });
  if (!handler) {
    throw new Error('No PanGestureHandler is rendered');
  }
  return handler;
};

/** Gives the gesture area a size, as the native layout pass would. */
export const layoutPanArea = (height: number, width = 20) => {
  fireEvent(getPanHandler(), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  });
};

/**
 * Sends one pan event the way RNGH delivers it on a device to a Reanimated
 * `useAnimatedGestureHandler`: state changes and moves alike go through
 * `onGestureHandlerEvent`, the channel the worklet is registered on.
 *
 * RNGH's own `fireGestureHandler` sends state changes to
 * `onHandlerStateChange` instead, which these components do not set, so with
 * it `onStart` / `onFinish` never run.
 */
const sendPanEvent = (event: { state: State; oldState?: State; y: number }) => {
  const handler = getPanHandler();
  act(() => {
    fireEvent(handler, 'onGestureHandlerEvent', {
      nativeEvent: {
        handlerTag: handler.props.handlerTag,
        numberOfPointers: 1,
        x: 0,
        ...event,
      },
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
