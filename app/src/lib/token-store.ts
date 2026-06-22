import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Token storage. On native we use `expo-secure-store` (Keychain / Keystore);
 * web has no equivalent secure store, so we fall back to AsyncStorage
 * (localStorage). Keys are SecureStore-safe (alphanumeric + ._-, no colon).
 */

const ACCESS_KEY = 'circle_access_token';
const REFRESH_KEY = 'circle_refresh_token';
const onWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (onWeb) await AsyncStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  return onWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (onWeb) await AsyncStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

export type Tokens = { accessToken: string; refreshToken: string };

export async function saveTokens(tokens: Tokens): Promise<void> {
  await Promise.all([
    setItem(ACCESS_KEY, tokens.accessToken),
    setItem(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function loadTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY)]);
}
