import { Tabs } from 'expo-router';
import { Bell, CalendarDays, Settings, Users } from 'lucide-react-native';

import { useTokens } from '@/theme/theme-provider';

// Reminders is the home tab - focus it first on mount even though `index`
// (Calendar) is the route that `/` resolves to.
export const unstable_settings = { initialRouteName: 'reminders' };

export default function TabsLayout() {
  const t = useTokens();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.biro,
        tabBarInactiveTintColor: t.inkMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.borderSubtle },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        sceneStyle: { backgroundColor: t.paper },
      }}>
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
