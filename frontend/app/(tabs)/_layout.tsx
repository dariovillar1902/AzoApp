import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name={icon} size={size} color={color} />,
});

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen name="index" options={tab('Mi lista', 'cart-outline')} />
      <Tabs.Screen name="semana" options={tab('Semana', 'calendar-outline')} />
      <Tabs.Screen name="explorar" options={tab('Explorar', 'pricetags-outline')} />
      <Tabs.Screen name="perfil" options={tab('Mis medios', 'card-outline')} />
    </Tabs>
  );
}
