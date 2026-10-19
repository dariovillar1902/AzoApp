import Constants from "expo-constants";
import { Platform } from "react-native";

/** Production deployment (Vercel project azoapp-frontend). */
const PRODUCTION_ORIGIN = "https://azoapp-frontend.vercel.app";

/**
 * Where the app's own API routes (app/api/*+api.ts) live:
 * - EXPO_PUBLIC_API_ORIGIN when set (e.g. to test another deployment);
 * - on web, the page's own origin;
 * - on a phone running from `npx expo start`, that same dev server on your PC
 *   (it searches the stores from your connection in Argentina);
 * - otherwise (installed build, or Expo Go without the PC) the Vercel deployment.
 */
export function apiOrigin(): string {
  if (process.env.EXPO_PUBLIC_API_ORIGIN) return process.env.EXPO_PUBLIC_API_ORIGIN;
  if (Platform.OS === "web") return "";
  const hostUri = Constants.expoConfig?.hostUri;
  return __DEV__ && hostUri ? `http://${hostUri}` : PRODUCTION_ORIGIN;
}
