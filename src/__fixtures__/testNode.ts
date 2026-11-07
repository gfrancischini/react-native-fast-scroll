/**
 * A rendered node as `findAll` hands it to its predicate. `react-test-renderer`
 * has no type package installed, so RNTL's `ReactTestInstance` is `any`; this
 * names the two fields the fixtures read.
 */
export type TestNode = {
  type: unknown;
  props: Record<string, any>;
};

/** Host nodes are the native views React Native would actually draw. */
export const isHostNode = (node: TestNode) => typeof node.type === 'string';
