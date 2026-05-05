import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_ENTERED_WORKSPACE_KEY = 'app-cleaner/has-entered-workspace';

export async function loadHasEnteredWorkspace(): Promise<boolean> {
  const value = await AsyncStorage.getItem(HAS_ENTERED_WORKSPACE_KEY);
  return value === 'true';
}

export async function saveHasEnteredWorkspace(hasEnteredWorkspace: boolean): Promise<void> {
  await AsyncStorage.setItem(HAS_ENTERED_WORKSPACE_KEY, hasEnteredWorkspace ? 'true' : 'false');
}
