import { StyleSheet } from 'react-native';
import { act } from '@testing-library/react-native';
import { getPanHandler } from './gestures';
import { isHostNode, TestNode } from './testNode';

/** One frame at 60 fps. */
const FRAME_MS = 16;

/**
 * Reanimated applies animated styles on the next frame. Under Jest, Reanimated
 * 2.12 leaves the *initial* animated style in `style` and keeps the live value
 * in an `animatedStyle` prop on the host view; this reads that prop, the same
 * way `getAnimatedStyle` in Reanimated's `jestUtils` does (2.12 does not
 * export it).
 */
const readTranslateY = (node: TestNode, what: string): number => {
  const transform: Record<string, number>[] =
    node.props.animatedStyle?.value?.transform ?? [];
  const translateY = transform.find((t) => 'translateY' in t)?.translateY;
  if (translateY === undefined) {
    throw new Error(`The ${what} has no animated translateY`);
  }
  return translateY;
};

/**
 * Where the scroll bar's thumb sits: its `translateY` inside the pan area, as
 * the user sees it. Advances one frame first, so the suite must use fake
 * timers.
 *
 * The thumb is the one absolutely positioned view in the pan area of both
 * `FastScrollIndicator` and the dots bar: it floats over the track.
 */
export const getThumbPosition = (): number => {
  act(() => jest.advanceTimersByTime(FRAME_MS));

  const thumbs: TestNode[] = getPanHandler().findAll(
    (node: TestNode) =>
      isHostNode(node) &&
      StyleSheet.flatten(node.props.style)?.position === 'absolute'
  );
  if (thumbs.length !== 1) {
    throw new Error(`Expected one thumb on screen, found ${thumbs.length}`);
  }
  return readTranslateY(thumbs[0]!, 'thumb');
};

/**
 * How far the dots bar has scrolled its own strip of dots, as a (negative)
 * `translateY`; 0 when it shows the first dot at the top. The strip is the pan
 * area itself.
 *
 * The strip glides there with a spring, so this lets it settle first (1 s);
 * the suite must use fake timers.
 */
export const getDotsScrollOffset = (): number => {
  act(() => jest.advanceTimersByTime(1000));

  const [strip] = getPanHandler().findAll(
    (node: TestNode) =>
      isHostNode(node) && node.props.handlerType === 'PanGestureHandler'
  );
  if (!strip) {
    throw new Error('No dots strip on screen');
  }
  return readTranslateY(strip, 'dots strip');
};
