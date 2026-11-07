const NodeEnvironment = require('jest-environment-node').default;

/**
 * Node >= 18 exposes `globalThis.performance` as a read-only accessor, but
 * `react-native/jest/setup.js` (RN 0.70) assigns `global.performance` directly.
 * Redefine it as a plain writable property before the setup files run.
 */
class ReactNativeEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    Object.defineProperty(this.global, 'performance', {
      value: this.global.performance,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
}

module.exports = ReactNativeEnvironment;
