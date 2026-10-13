import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Ionicons, type IconName } from '../../ui';
import { useColors } from '../../theme';

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.faint,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.page },
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 20, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', headerShown: false, tabBarIcon: icon('tennisball-outline') }} />
      <Tabs.Screen name="map" options={{ title: '지도', tabBarIcon: icon('map-outline') }} />
      <Tabs.Screen name="alerts" options={{ title: '알림', tabBarIcon: icon('notifications-outline') }} />
      <Tabs.Screen name="me" options={{ title: '내 정보', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
