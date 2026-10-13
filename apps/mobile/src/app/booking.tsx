// 예약 팝업: the Seoul booking page in a plain WebView. The user logs in and books by themselves.
// No injected JS, no message bridge, no cookie or content access (CLAUDE.md "확인 사항").

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useData } from '../data';
import { useColors } from '../theme';
import { Ionicons } from '../ui';

export default function Booking() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const c = useColors();
  const [progress, setProgress] = useState(0);
  const { keepLogin } = useData();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.card }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          style={({ pressed }) => [styles.icon, { backgroundColor: c.surface, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="close" size={20} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {title || '예약하기'}
        </Text>
        {url ? (
          <Pressable
            onPress={() => Linking.openURL(url)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="브라우저에서 열기"
            style={({ pressed }) => [styles.icon, { backgroundColor: c.surface, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="open-outline" size={18} color={c.text} />
          </Pressable>
        ) : (
          <View style={styles.icon} />
        )}
      </View>
      <View style={[styles.notice, { backgroundColor: c.accentSoft }]}>
        <Ionicons name="information-circle" size={16} color={c.accentText} />
        <Text style={[styles.noticeText, { color: c.text }]}>서울시 예약 화면이에요. 로그인과 예약은 직접 진행해 주세요.</Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.border }]}>
        {progress < 1 ? <View style={{ width: `${Math.max(progress, 0.05) * 100}%`, height: '100%', backgroundColor: c.accent }} /> : null}
      </View>
      {url ? (
        <WebView source={{ uri: url }} incognito={!keepLogin} onLoadProgress={(e) => setProgress(e.nativeEvent.progress)} style={{ backgroundColor: c.bg }} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  noticeText: { flex: 1, fontSize: 13 },
  track: { height: 2 },
});
