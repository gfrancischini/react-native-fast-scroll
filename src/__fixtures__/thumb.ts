import { StyleSheet } from 'react-native';
import { act } from '@testing-library/react-native';
import { getPanHandler } from './gestures';
import { isHostNode, TestNode } from './testNode';

/** One frame at 60 fps. */
const FRAME_MS = 16;

/**
 * Where the scroll bar's thumb sits: its `translateY` inside the pan area, as
 * the user sees it.
 *
 * Reanimated applies animated styles on the next frame, so this first advances
 * one frame - the suite must use fake timers. Under Jest, Reanimated 2.12
 * leaves the *initial* animated style in `style` and keeps the live value in an
 * `animatedStyle` prop on the host view; this reads that prop, the same way
 * `getAnimatedStyle` in Reanimated's `jestUtils` does (2.12 does not export it).
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

  const transform: Record<string, number>[] =
    thumbs[0]!.props.animatedStyle?.value?.transform ?? [];
  const translateY = transform.find((t) => 'translateY' in t)?.translateY;
  if (translateY === undefined) {
    throw new Error('The thumb has no animated translateY');
  }
  return translateY;
};
