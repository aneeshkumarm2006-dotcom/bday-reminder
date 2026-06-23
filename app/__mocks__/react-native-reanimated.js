/* eslint-disable no-undef */
// Manual Jest mock for react-native-reanimated (TODO Stage 13).
//
// Reanimated 4's bundled `react-native-reanimated/mock` transitively loads
// react-native-worklets' native module, which throws under Jest. The components
// only use reanimated to *render the static state* of the ring (we don't assert
// animation timing), so this lightweight mock provides just the API surface they
// touch and makes `useReducedMotion` true → rings render their filled/static
// look instantly with no animation machinery. Jest picks this up automatically
// for the `react-native-reanimated` node module (root `__mocks__/`).
const React = require('react');
const RN = require('react-native');

const Animated = {
  createAnimatedComponent: (Component) => Component,
  View: RN.View,
  Text: RN.Text,
  ScrollView: RN.ScrollView,
  Image: RN.Image,
  FlatList: RN.FlatList,
};

const identity = (value) => value;
const callOrEmpty = (fn) => {
  try {
    return typeof fn === 'function' ? fn() : {};
  } catch {
    return {};
  }
};

const easingFn = (t) => t;
const Easing = {
  linear: easingFn,
  ease: easingFn,
  quad: easingFn,
  cubic: easingFn,
  in: () => easingFn,
  out: () => easingFn,
  inOut: () => easingFn,
  bezier: () => easingFn,
};

module.exports = {
  __esModule: true,
  default: Animated,
  Easing,
  useSharedValue: (initial) => ({ value: initial }),
  useDerivedValue: (fn) => ({ value: callOrEmpty(fn) }),
  useAnimatedProps: (fn) => callOrEmpty(fn),
  useAnimatedStyle: (fn) => callOrEmpty(fn),
  useAnimatedRef: () => React.createRef(),
  useReducedMotion: () => true,
  withTiming: identity,
  withDelay: (_delay, value) => value,
  withSpring: identity,
  withRepeat: identity,
  withSequence: (...values) => values[values.length - 1],
  cancelAnimation: () => {},
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (value) => value,
  interpolateColor: (_value, _input, output) => (Array.isArray(output) ? output[0] : '#000000'),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
};
