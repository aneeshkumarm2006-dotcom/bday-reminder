import { Tabs } from 'expo-router';
import { Bell, CalendarDays, Contact, Settings, Users } from 'lucide-react-native';

import { useTokens } from '@/theme/theme-provider';

// Calendar (`index`, the route `/` resolves to) is the home tab - listed first
// in the tab bar and focused on mount.
export const unstable_settings = { initialRouteName: 'index' };

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
        name="index"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color, size }) => <Contact color={color} size={size} strokeWidth={1.75} />,
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
