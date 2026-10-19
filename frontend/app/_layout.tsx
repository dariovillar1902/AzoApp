import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { SettingsProvider } from '../lib/client/profile';
import '../global.css';

if (Platform.OS !== 'web') {
  // Show reminders even when the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="discount/[id]" options={{ headerShown: false }} />
      </Stack>
    </SettingsProvider>
  );
}
