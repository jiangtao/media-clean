// Entry point for React Native
// This file must be the first to load to ensure FormData shim is applied before any other modules

import './shims/formdata-shim';
import './shims/immediate-shim';
import './shims/websocket-shim';
import './shims/window-shim';
import './shims/performance-shim';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
