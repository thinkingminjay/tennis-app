import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { DataProvider } from '../data';
import { useColors } from '../theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.bg, text: c.text, border: c.border },
  };

  return (
    <DataProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="auto" />
        <NotificationOpener />
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="facility/[id]" options={{ title: '' }} />
          <Stack.Screen name="alert" options={{ presentation: 'modal', title: '알림 조건' }} />
          <Stack.Screen name="booking" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </DataProvider>
  );
}

// Tapping a single-event notification opens that listing's booking page; a bundled one opens the 알림 tab.
function NotificationOpener() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const { content } = response.notification.request;
    const url = content.data?.url;
    if (typeof url === 'string') {
      router.push({ pathname: '/booking', params: { url, title: content.title ?? '' } });
    } else {
      router.navigate('/alerts');
    }
  }, [response]);

  return null;
}
