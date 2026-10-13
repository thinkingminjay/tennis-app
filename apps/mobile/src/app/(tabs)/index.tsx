// 홈: filter chips + facility cards. Server data only, no login.
// Facility photos load only on the detail screen, one at a time, so opening the app does not
// fire dozens of image requests at yeyak.seoul.go.kr.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Facility, Listing } from '../../api';
import { useData } from '../../data';
import { EMPTY_FILTER, RECEIVING, UPCOMING, isFiltered, listingMatches, minutesAgo, type Filter } from '../../format';
import { useColors } from '../../theme';
import { Button, Chip, CountBadge, Empty, Ionicons, SourceFooter, SurfaceBall, surfaceColors } from '../../ui';

interface Row {
  facility: Facility;
  listings: Listing[];
  open: number;
  soon: number;
}

export default function Home() {
  const c = useColors();
  const { facilities, listingsByFacility, updatedAt, loading, error, reload, favorites, simpleWatch } = useData();
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [districtsOpen, setDistrictsOpen] = useState(false);

  const districts = useMemo(
    () => [...new Set(facilities.map((f) => f.district).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, 'ko')),
    [facilities],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const f of facilities) {
      if (filter.districts.length && !filter.districts.includes(f.district ?? '')) continue;
      const all = listingsByFacility.get(f.id) ?? [];
      const listings = all.filter((l) => listingMatches(l, filter));
      if (isFiltered(filter) && listings.length === 0) continue;
      out.push({
        facility: f,
        listings,
        open: listings.filter((l) => l.status === RECEIVING).length,
        soon: listings.filter((l) => l.status === UPCOMING).length,
      });
    }
    return out.sort(
      (a, b) =>
        Number(favorites.has(b.facility.id)) - Number(favorites.has(a.facility.id)) ||
        Number(b.open > 0) - Number(a.open > 0) ||
        a.facility.name.localeCompare(b.facility.name, 'ko'),
    );
  }, [facilities, listingsByFacility, filter, favorites]);

  const openFacilities = rows.filter((r) => r.open > 0).length;
  const set = (patch: Partial<Filter>) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.page }} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>테니스장</Text>
        <Text style={[styles.meta, { color: c.sub }]}>{minutesAgo(updatedAt)}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {isFiltered(filter) ? (
          <Pressable
            onPress={() => setFilter(EMPTY_FILTER)}
            accessibilityRole="button"
            accessibilityLabel="필터 초기화"
            style={({ pressed }) => [styles.reset, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="refresh" size={15} color={c.text} />
            <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>초기화</Text>
          </Pressable>
        ) : null}
        <Chip label="접수중만" selected={filter.open} onPress={() => set({ open: !filter.open })} />
        <Chip
          label={filter.districts.length ? `${filter.districts[0]}${filter.districts.length > 1 ? ` 외 ${filter.districts.length - 1}` : ''}` : '지역'}
          selected={filter.districts.length > 0}
          icon="chevron-down"
          onPress={() => setDistrictsOpen(true)}
        />
        <Chip label="평일" selected={filter.day === '평일'} onPress={() => set({ day: filter.day === '평일' ? null : '평일' })} />
        <Chip label="주말" selected={filter.day === '주말'} onPress={() => set({ day: filter.day === '주말' ? null : '주말' })} />
        <Chip label="주간" selected={filter.band === '주간'} onPress={() => set({ band: filter.band === '주간' ? null : '주간' })} />
        <Chip label="야간" selected={filter.band === '야간'} onPress={() => set({ band: filter.band === '야간' ? null : '야간' })} />
        <Chip label="무료" selected={filter.free} onPress={() => set({ free: !filter.free })} />
      </ScrollView>

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(r) => r.facility.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <FacilityCard row={item} favorite={favorites.has(item.facility.id)} watching={!!simpleWatch(item.facility.id)} />
        )}
        ListEmptyComponent={
          loading ? null : isFiltered(filter) ? (
            <View>
              <Empty icon="search-outline" title="조건에 맞는 테니스장이 없어요" body="필터를 줄여 보세요." />
              <Button label="필터 초기화" kind="secondary" onPress={() => setFilter(EMPTY_FILTER)} style={{ alignSelf: 'center' }} />
            </View>
          ) : (
            <Empty icon="cloud-offline-outline" title="테니스장 정보를 불러오지 못했어요" body="아래로 당겨 다시 시도해 주세요." />
          )
        }
        ListHeaderComponent={
          rows.length ? (
            <View style={styles.resultRow}>
              <Text style={{ color: c.sub, fontSize: 13 }}>
                총 <Text style={{ color: c.text, fontWeight: '700' }}>{rows.length}</Text>곳
                {openFacilities ? (
                  <Text>
                    {' · 접수중 '}
                    <Text style={{ color: c.accent, fontWeight: '700' }}>{openFacilities}</Text>곳
                  </Text>
                ) : null}
              </Text>
              {isFiltered(filter) ? (
                <Pressable onPress={() => setFilter(EMPTY_FILTER)} hitSlop={8}>
                  <Text style={{ color: c.accent, fontWeight: '600', fontSize: 13 }}>필터 초기화</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
        ListFooterComponent={<SourceFooter />}
      />

      <Modal visible={districtsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDistrictsOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: c.bg }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>지역</Text>
            <Pressable onPress={() => set({ districts: [] })} hitSlop={8}>
              <Text style={{ color: c.sub }}>전체 해제</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.districtGrid}>
            {districts.map((d) => {
              const on = filter.districts.includes(d);
              return (
                <Chip
                  key={d}
                  label={d}
                  selected={on}
                  onPress={() => set({ districts: on ? filter.districts.filter((x) => x !== d) : [...filter.districts, d] })}
                />
              );
            })}
          </ScrollView>
          <Button label="적용" onPress={() => setDistrictsOpen(false)} style={{ margin: 20 }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FacilityCard({ row, favorite, watching }: { row: Row; favorite: boolean; watching: boolean }) {
  const c = useColors();
  const { facility: f, listings, open, soon } = row;
  const free = listings.some((l) => l.paid === false);
  const paid = listings.some((l) => l.paid !== false);
  return (
    <Pressable
      onPress={() => router.push(`/facility/${f.id}`)}
      style={({ pressed }) => [styles.card, { backgroundColor: c.card, opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole="button"
    >
      <View style={styles.cardMain}>
        <View style={[styles.thumb, { backgroundColor: open ? c.accentSoft : c.offSoft }]}>
          <SurfaceBall colors={surfaceColors(c, f.surfaces)} size={22} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.cardTop}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {f.name}
            </Text>
            {favorite ? <Ionicons name="star" size={15} color={c.soon} /> : null}
            {watching ? <Ionicons name="notifications" size={15} color={c.accent} /> : null}
          </View>
          <Text style={[styles.meta, { color: c.sub }]} numberOfLines={1}>
            {[f.district, free && paid ? '무료·유료' : free ? '무료' : '유료'].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.faint} />
      </View>
      <View style={[styles.cardFoot, { borderTopColor: c.border }]}>
        <Text style={[styles.meta, { color: c.sub }]}>
          접수중{' '}
          <Text style={{ color: open ? c.accent : c.sub, fontWeight: '700' }}>{open}</Text>
          <Text style={{ color: c.faint }}> / {listings.length}</Text>
        </Text>
        {soon ? <CountBadge status={UPCOMING} count={soon} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  meta: { fontSize: 13 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1 },
  error: { paddingHorizontal: 20, paddingBottom: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 },
  card: { borderRadius: 16, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  sheet: { flex: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  districtGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
});
