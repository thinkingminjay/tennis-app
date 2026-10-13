// 알림 만들기/수정: 테니스장(복수) → 코트(테니스장 1곳일 때만) → 평일/주말·주간/야간 → 받을 소식.
// Params: id (edit an existing watch) or facility (preselect one facility).

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EventKind } from '../api';
import { useData } from '../data';
import { ALL_EVENTS, EVENT_LABEL, courtOrder, isOffline } from '../format';
import { useColors } from '../theme';
import { Button, Chip, Ionicons, SectionTitle } from '../ui';

const EVENT_HINT: Record<EventKind, string> = {
  new_listing: '새 상품이 올라오면',
  receipt_open: '상품이 접수중으로 바뀌면',
  status_change: '예약마감·접수종료 등 상태가 바뀌면',
};

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function AlertEditor() {
  const params = useLocalSearchParams<{ id?: string; facility?: string }>();
  const c = useColors();
  const { facilities, facilityById, listingsByFacility, watches, upsertWatch, removeWatch } = useData();
  const existing = watches.find((w) => w.id === params.id);

  const [facilityIds, setFacilityIds] = useState<string[]>(existing?.facility_ids ?? (params.facility ? [params.facility] : []));
  const [courtIds, setCourtIds] = useState<string[]>(existing?.court_ids ?? []);
  const [days, setDays] = useState<string[]>(existing?.day_types ?? []);
  const [bands, setBands] = useState<string[]>(existing?.time_bands ?? []);
  const [events, setEvents] = useState<EventKind[]>(existing?.events ?? ALL_EVENTS);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Courts are only offered for a single facility; court ids from listings of that facility.
  const courts = useMemo(() => {
    if (facilityIds.length !== 1) return [];
    const m = new Map<string, string>();
    for (const l of listingsByFacility.get(facilityIds[0]) ?? []) if (l.court) m.set(l.court.id, l.court.label);
    return [...m.entries()].sort(([, a], [, b]) => courtOrder(a, b));
  }, [facilityIds, listingsByFacility]);

  const bookable = facilities.filter((f) => !isOffline(f));
  const matches = query.trim()
    ? bookable.filter((f) => f.name.includes(query.trim()) || f.district?.includes(query.trim()))
    : bookable;

  function setFacilities(next: string[]) {
    setFacilityIds(next);
    if (next.length !== 1) setCourtIds([]);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await upsertWatch(existing?.id ?? null, {
        facility_ids: facilityIds,
        court_ids: courtIds.length ? courtIds : null,
        day_types: days.length ? days : null,
        time_bands: bands.length ? bands : null,
        events,
        enabled: existing?.enabled ?? true,
      });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes('HTTP 400') ? '알림 조건은 20개까지 만들 수 있어요' : `저장하지 못했어요 (${msg})`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    await removeWatch(existing.id).catch(() => {});
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        <SectionTitle right={<Text style={{ color: c.sub }}>{facilityIds.length}곳 선택</Text>}>테니스장</SectionTitle>
        {facilityIds.length ? (
          <View style={styles.wrap}>
            {facilityIds.map((id) => (
              <Chip key={id} label={facilityById.get(id)?.name ?? '?'} selected icon="close" onPress={() => setFacilities(facilityIds.filter((x) => x !== id))} />
            ))}
          </View>
        ) : null}
        <View style={[styles.search, { backgroundColor: c.surface }]}>
          <Ionicons name="search" size={16} color={c.sub} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="테니스장·자치구 검색"
            placeholderTextColor={c.faint}
            style={{ flex: 1, color: c.text, fontSize: 15 }}
          />
        </View>
        <View style={styles.list}>
          {matches.slice(0, query ? 50 : 8).map((f) => {
            const on = facilityIds.includes(f.id);
            return (
              <Pressable key={f.id} onPress={() => setFacilities(toggle(facilityIds, f.id))} style={[styles.option, { borderBottomColor: c.border }]}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.accentText : c.faint} />
                <Text style={{ flex: 1, color: c.text, fontSize: 15 }}>{f.name}</Text>
                <Text style={{ color: c.sub, fontSize: 13 }}>{f.district}</Text>
              </Pressable>
            );
          })}
          {!query && matches.length > 8 ? <Text style={{ color: c.faint, paddingVertical: 10 }}>검색해서 더 찾아보세요</Text> : null}
        </View>

        {courts.length ? (
          <>
            <SectionTitle>코트</SectionTitle>
            <View style={styles.wrap}>
              <Chip label="전체" selected={courtIds.length === 0} onPress={() => setCourtIds([])} />
              {courts.map(([id, label]) => (
                <Chip key={id} label={label} selected={courtIds.includes(id)} onPress={() => setCourtIds(toggle(courtIds, id))} />
              ))}
            </View>
          </>
        ) : null}

        <SectionTitle>요일·시간대</SectionTitle>
        <View style={styles.wrap}>
          {['평일', '주말'].map((d) => (
            <Chip key={d} label={d} selected={days.includes(d)} onPress={() => setDays(toggle(days, d))} />
          ))}
          <View style={{ width: 8 }} />
          {['주간', '야간'].map((b) => (
            <Chip key={b} label={b} selected={bands.includes(b)} onPress={() => setBands(toggle(bands, b))} />
          ))}
        </View>
        <Text style={[styles.hint, { color: c.faint }]}>선택하지 않으면 모두 받아요.</Text>

        <SectionTitle>받을 소식</SectionTitle>
        <View style={styles.list}>
          {ALL_EVENTS.map((e) => {
            const on = events.includes(e);
            return (
              <Pressable key={e} onPress={() => setEvents(toggle(events, e))} style={[styles.option, { borderBottomColor: c.border }]}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.accentText : c.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 15 }}>{EVENT_LABEL[e]}</Text>
                  <Text style={{ color: c.sub, fontSize: 13 }}>{EVENT_HINT[e]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: c.faint }]}>시간대별 빈자리 알림은 아직 지원하지 않아요.</Text>

        {existing ? <Button label="이 알림 삭제" kind="danger" onPress={remove} disabled={busy} style={{ marginTop: 16 }} /> : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.bottom, { borderTopColor: c.border }]}>
        {error ? <Text style={{ color: c.danger, marginBottom: 8 }}>{error}</Text> : null}
        <Button
          label={existing ? '저장' : '알림 만들기'}
          onPress={save}
          disabled={busy || facilityIds.length === 0 || events.length === 0}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 4, paddingHorizontal: 12, height: 42, borderRadius: 10 },
  list: { paddingHorizontal: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  hint: { fontSize: 12, paddingHorizontal: 20, paddingTop: 6 },
  bottom: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
