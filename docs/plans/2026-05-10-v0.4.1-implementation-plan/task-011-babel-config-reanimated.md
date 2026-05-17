# Task 011: Add Babel config for Reanimated

## BDD Scenario

N/A - Configuration task

## Task

Add Reanimated Babel plugin to babel.config.js.

## Files to Modify

- `babel.config.js`

## Implementation Steps

1. Open babel.config.js
2. Add 'react-native-reanimated/plugin' to plugins array
3. Ensure the plugin is last in the plugins list (required)

## Expected Config

```javascript
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

## Verification

- [ ] Babel config updated
- [ ] App builds without error
- [ ] Reanimated worklets compile correctly

## Post-Config Note

After modifying Babel config, clear cache:
```bash
npx expo start --clear
```

## depends-on

["001"]
