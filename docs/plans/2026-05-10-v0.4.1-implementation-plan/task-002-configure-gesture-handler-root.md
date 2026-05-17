# Task 002: Configure GestureHandlerRootView

## BDD Scenario

N/A - Configuration task

## Task

Add GestureHandlerRootView wrapper to MediaCleanerApp root component.

## Files to Modify

- `src/application/MediaCleanerApp.tsx`

## Implementation Steps

1. Import `GestureHandlerRootView` from 'react-native-gesture-handler'
2. Wrap existing app content with `GestureHandlerRootView`
3. Apply `style={{ flex: 1 }}` to root view

## Verification

- [ ] App renders without error
- [ ] GestureHandlerRootView is at root level
- [ ] Children components receive touch events

## depends-on

["001"]
