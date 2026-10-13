import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 'ask' means the system prompt can still be shown; 'denied' means only the Settings app can turn it on.
export type Permission = 'granted' | 'ask' | 'denied';

// Reads the current permission without prompting.
export async function pushPermission(): Promise<Permission> {
  if (!Device.isDevice) return 'denied';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : canAskAgain ? 'ask' : 'denied';
}

// Asks for permission, gets the Expo push token and registers it with Supabase.
// Returns null on simulators or when the user declines.
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '테니스장 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerDevice(token, Platform.OS);
  return token;
}
