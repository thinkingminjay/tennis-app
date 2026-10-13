// 예약 팝업: the Seoul booking page in a plain WebView. The user logs in and books by themselves.
// No injected JS, no message bridge, no cookie or content access (CLAUDE.md "확인 사항").

import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useColors } from '../theme';

export default function Booking() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          {title ? (
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <Text style={[styles.notice, { color: c.sub }]}>서울시 예약 화면입니다. 예약은 직접 진행해 주세요</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.close, { color: c.accentText }]}>닫기</Text>
        </Pressable>
      </View>
      {url ? (
        <WebView
          source={{ uri: url }}
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} />}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 15, fontWeight: '600' },
  notice: { fontSize: 12, marginTop: 2 },
  close: { fontSize: 16, fontWeight: '600' },
});
