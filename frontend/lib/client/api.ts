import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Where the app's own API routes (app/api/*+api.ts) live. On web they share
 * the page's origin; on a device in development they're served by the same
 * Metro dev server the bundle came from. Set EXPO_PUBLIC_API_ORIGIN for a
 * deployed server.
 */
export function apiOrigin(): string {
  if (process.env.EXPO_PUBLIC_API_ORIGIN) return process.env.EXPO_PUBLIC_API_ORIGIN;
  if (Platform.OS === "web") return "";
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri ? `http://${hostUri}` : "http://localhost:8081";
}
