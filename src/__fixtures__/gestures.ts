import { act, fireEvent, screen } from '@testing-library/react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';

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
 * Drags a finger through each `y` (relative to the gesture area) in order.
 *
 * Under Jest only the `ACTIVE` move events reach a Reanimated
 * `useAnimatedGestureHandler`; the state changes (`BEGAN`, the first `ACTIVE`,
 * `END`) are routed to `onHandlerStateChange`, which these components do not
 * set. So the component sees one `onActive` per `y` and never `onStart` /
 * `onFinish`.
 */
export const dragThroughPositions = (ys: [number, ...number[]]) => {
  const [first] = ys;
  const last = ys[ys.length - 1];
  act(() =>
    fireGestureHandler<PanGestureHandler>(getPanHandler(), [
      { state: State.BEGAN, y: first },
      { state: State.ACTIVE, y: first },
      ...ys.map((y) => ({ state: State.ACTIVE, y })),
      { state: State.END, y: last },
    ])
  );
};
