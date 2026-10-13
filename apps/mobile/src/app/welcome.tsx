// 첫 실행 알림 안내: explains what notifications are sent before the system permission prompt,
// so the one-time iOS prompt is shown only to people who chose to turn alerts on.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData } from '../data';
import { useColors } from '../theme';
import { Button, Card, Ionicons } from '../ui';

const ROWS = [
  { icon: 'sparkles-outline', title: '새 상품이 올라오면', body: '관심 테니스장에 새 예약 상품이 생겼을 때' },
  { icon: 'alarm-outline', title: '접수가 시작되면', body: '접수 예정이던 상품이 접수중으로 바뀔 때' },
  { icon: 'swap-horizontal-outline', title: '상태가 바뀌면', body: '접수종료 등 예약 상태가 달라졌을 때' },
  { icon: 'moon-outline', title: '밤에는 조용히', body: '밤 11시~아침 7시에는 보내지 않아요' },
] as const;

export default function Welcome() {
  const c = useColors();
  const { permission, enablePush, finishWelcome } = useData();
  const [busy, setBusy] = useState(false);

  const close = () => {
    finishWelcome();
    router.back();
  };

  const primary = async () => {
    if (permission === 'granted') return close();
    setBusy(true);
    await enablePush();
    setBusy(false);
    close();
  };

  const label =
    permission === 'granted' ? '시작하기' : permission === 'denied' ? '설정에서 알림 켜기' : '알림 받기';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.page }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.badge, { backgroundColor: c.accent }]}>
          <Image source={require('../../assets/splash-icon.png')} style={styles.ball} />
        </View>
        <Text style={[styles.title, { color: c.text }]}>자리가 열리면{'\n'}알려 드릴게요</Text>
        <Text style={[styles.lead, { color: c.sub }]}>
          테니스장을 골라 두면 예약 소식이 바뀔 때 알림을 보내요. 로그인이나 개인정보는 필요 없어요.
        </Text>

        <Card style={styles.card}>
          {ROWS.map((r, i) => (
            <View key={r.title} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
              <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
                <Ionicons name={r.icon} size={20} color={c.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: c.text }]}>{r.title}</Text>
                <Text style={{ color: c.sub, fontSize: 13 }}>{r.body}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Text style={[styles.note, { color: c.faint }]}>
          알림 받을 테니스장과 조건은 알림 탭에서 언제든 바꿀 수 있어요.
        </Text>
      </ScrollView>

      <View style={styles.bottom}>
        <Button label={label} onPress={primary} disabled={busy} />
        {permission === 'granted' ? null : (
          <Pressable onPress={close} accessibilityRole="button" style={styles.later} hitSlop={8}>
            <Text style={{ color: c.sub, fontSize: 15 }}>나중에 할게요</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 48, paddingBottom: 24 },
  badge: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginHorizontal: 24 },
  ball: { width: 60, height: 60 },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 36, marginTop: 24, marginHorizontal: 24 },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 12, marginHorizontal: 24 },
  card: { marginTop: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  note: { fontSize: 13, marginTop: 14, marginHorizontal: 24 },
  bottom: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  later: { alignItems: 'center', paddingVertical: 14 },
});
