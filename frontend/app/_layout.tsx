import { Stack } from 'expo-router';
import { SettingsProvider } from '../lib/client/profile';
import '../global.css';

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
