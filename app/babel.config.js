// Babel config for the Expo app.
//
// Order matters:
//  - `babel-preset-expo` with `jsxImportSource: 'nativewind'` rewrites the JSX
//    runtime so every component accepts a `className` prop. The preset also
//    auto-enables the React Compiler (app.json → experiments.reactCompiler) and
//    the react-native-worklets/reanimated plugin, so we don't list those here.
//  - `nativewind/babel` wires up the Tailwind -> RN style transform.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
