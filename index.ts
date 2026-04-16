// Polyfill for React Native 0.81.5 - FormData
if (typeof global.FormData === 'undefined') {
  global.FormData = require('form-data');
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
