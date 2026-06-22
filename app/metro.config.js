// Metro config for the Expo app.
// `withNativeWind` compiles `src/global.css` (Tailwind directives + design
// tokens) and feeds the generated styles into the bundler for web + native.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
