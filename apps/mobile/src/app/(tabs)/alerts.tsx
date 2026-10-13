// 알림 탭: this device's watch conditions (on/off, edit) and the history of sent notifications.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { myNotifications, type SentNotification } from '../../api';
import { useData } from '../../data';
import { timeAgo, watchSummary, watchTitle } from '../../format';
import { useColors } from '../../theme';
import { Button, Empty, Ionicons, SectionTitle } from '../../ui';

export default function AlertsTab() {
  const c = useColors();
  const { token, push, enablePush, watches, facilityById, upsertWatch, reloadWatches } = useData();
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    await Promise.all([reloadWatches(), myNotifications(token).then(setHistory)]).catch(() => {});
    setRefreshing(false);
  }, [token, reloadWatches]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (push !== 'ready') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <Empty
          icon="notifications-off-outline"
          title={push === 'pending' ? '알림을 준비하고 있어요' : '알림 권한이 꺼져 있어요'}
          body="접수 시작, 새 상품, 상태 변화를 알려 드려요. 시간대별 빈자리 알림은 아직 지원하지 않아요."
        />
        {push === 'off' ? <Button label="알림 켜기" onPress={enablePush} style={{ alignSelf: 'center' }} /> : null}
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/alert')} hitSlop={8} style={styles.add} accessibilityRole="button">
            <Ionicons name="add" size={18} color={c.accent} />
            <Text style={{ color: c.accent, fontWeight: '600' }}>추가</Text>
          </Pressable>
        }
      >
        알림 조건
      </SectionTitle>

      {watches.length === 0 ? (
        <Empty icon="notifications-outline" title="아직 알림 조건이 없어요" body="테니스장 상세에서 '알림 받기'를 누르거나 조건을 추가해 보세요." />
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {watches.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => router.push({ pathname: '/alert', params: { id: w.id } })}
              style={({ pressed }) => [styles.watch, { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.watchTitle, { color: w.enabled ? c.text : c.sub }]} numberOfLines={1}>
                  {watchTitle(w, facilityById)}
                </Text>
                <Text style={{ color: c.sub, fontSize: 13 }} numberOfLines={2}>
                  {watchSummary(w)}
                </Text>
              </View>
              <Switch
                value={w.enabled}
                onValueChange={(enabled) => upsertWatch(w.id, { ...w, enabled }).catch(() => {})}
                trackColor={{ true: c.accent }}
              />
            </Pressable>
          ))}
        </View>
      )}

      <SectionTitle>받은 알림</SectionTitle>
      {history.length === 0 ? (
        <Empty icon="mail-outline" title="받은 알림이 없어요" />
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          {history.map((n) => (
            <Pressable
              key={n.id}
              disabled={!n.url}
              onPress={() => router.push({ pathname: '/booking', params: { url: n.url!, title: n.title } })}
              style={({ pressed }) => [styles.item, { borderBottomColor: c.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{n.title}</Text>
                <Text style={{ color: c.sub, fontSize: 13 }}>{n.body}</Text>
              </View>
              <Text style={{ color: c.faint, fontSize: 12 }}>{timeAgo(n.sent_at)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  add: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  watch: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14 },
  watchTitle: { fontSize: 15, fontWeight: '700' },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
