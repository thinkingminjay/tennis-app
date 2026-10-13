// 테니스장 상세: photo, courts with their listings (status + period chips), receipt windows,
// contact, last update. Tapping a listing opens the Seoul booking page in the popup.

import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Listing } from '../../api';
import { useData } from '../../data';
import { RECEIVING, bandLabel, courtOrder, minutesAgo, period, receiptNote, tone } from '../../format';
import { useColors } from '../../theme';
import { Button, Card, Empty, Ionicons, SURFACE_LABEL, SectionTitle, SourceFooter, Stat, StatusPill, SurfaceBall, surfaceColors } from '../../ui';

const NO_COURT = '코트 구분 없음';

export default function FacilityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { facilityById, listingsByFacility, favorites, toggleFavorite, simpleWatch, toggleSimpleWatch, push } = useData();
  const f = facilityById.get(id);
  const listings = useMemo(() => listingsByFacility.get(id) ?? [], [listingsByFacility, id]);

  const courts = useMemo(() => {
    const map = new Map<string, Listing[]>();
    for (const l of listings) {
      const key = l.court?.label ?? NO_COURT;
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => Number(b.status === RECEIVING) - Number(a.status === RECEIVING) || (a.period_start ?? '').localeCompare(b.period_start ?? ''));
    }
    return [...map.entries()].sort(([a], [b]) => (a === NO_COURT ? 1 : b === NO_COURT ? -1 : courtOrder(a, b)));
  }, [listings]);

  if (!f) return <Empty icon="alert-circle-outline" title="테니스장을 찾을 수 없어요" />;

  const favorite = favorites.has(f.id);
  const watching = !!simpleWatch(f.id);
  const updated = listings.reduce<string | undefined>((a, l) => (!a || l.updated_at > a ? l.updated_at : a), undefined);
  const open = listings.filter((l) => l.status === RECEIVING).length;
  const free = listings.some((l) => l.paid === false);
  const paid = listings.some((l) => l.paid !== false);

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen
        options={{
          title: f.name,
          headerRight: () => (
            <Pressable onPress={() => toggleFavorite(f.id)} hitSlop={10} accessibilityLabel={favorite ? '즐겨찾기 해제' : '즐겨찾기'}>
              <Ionicons name={favorite ? 'star' : 'star-outline'} size={22} color={favorite ? c.soon : c.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        {f.image_url ? (
          <Image source={{ uri: f.image_url }} style={[styles.photo, { backgroundColor: c.surface }]} contentFit="cover" transition={150} />
        ) : null}

        <View style={[styles.head, { backgroundColor: c.card }]}>
          <Text style={[styles.district, { color: c.sub }]}>{f.district ?? '서울'}</Text>
          <Text style={[styles.name, { color: c.text }]}>{f.name}</Text>
          <View style={styles.stats}>
            <Stat label="접수중" value={`${open}개`} accent={open > 0} />
            <Stat label="전체 상품" value={`${listings.length}개`} />
            <Stat label="요금" value={free && paid ? '무료·유료' : free ? '무료' : '유료'} />
          </View>
          <View style={[styles.notice, { backgroundColor: c.surface }]}>
            <Ionicons name="information-circle" size={16} color={c.sub} style={{ marginTop: 1 }} />
            <Text style={[styles.noticeText, { color: c.sub }]}>
              ‘접수중’은 접수 기간이라는 뜻이에요. 빈자리는 예약 화면 달력에서 확인해 주세요.
            </Text>
          </View>
          <Text style={[styles.meta, { color: c.faint, marginTop: 8 }]}>{minutesAgo(updated)}</Text>
        </View>

        {courts.map(([label, items]) => (
          <View key={label}>
            <SectionTitle right={<Text style={[styles.meta, { color: c.sub }]}>{items.length}개</Text>}>{label}</SectionTitle>
            <Card>
              {items.map((l, i) => (
                <ListingRow key={l.svc_id} listing={l} first={i === 0} />
              ))}
            </Card>
          </View>
        ))}

        {f.address || f.phone || f.surfaces?.length ? (
          <>
            <SectionTitle>정보</SectionTitle>
            <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              {f.surfaces?.length ? (
                <View style={styles.info}>
                  <SurfaceBall colors={surfaceColors(c, f.surfaces)} size={18} />
                  <Text style={{ color: c.text, flex: 1 }}>
                    바닥 {f.surfaces.map((x) => SURFACE_LABEL[x]).join(' · ')}
                    <Text style={{ color: c.faint }}> (안내문 기준)</Text>
                  </Text>
                </View>
              ) : null}
              {f.address ? <InfoLine icon="location-outline" text={f.address} /> : null}
              {f.phone ? <InfoLine icon="call-outline" text={f.phone} onPress={() => Linking.openURL(`tel:${f.phone!.split(',')[0]}`)} /> : null}
            </Card>
          </>
        ) : null}

        <SourceFooter />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.bottom, { borderTopColor: c.border, backgroundColor: c.card }]}>
        <Button
          label={watching ? '알림 받는 중' : '이 테니스장 알림 받기'}
          icon={watching ? 'notifications' : 'notifications-outline'}
          kind={watching ? 'secondary' : 'primary'}
          disabled={push !== 'ready'}
          onPress={() => toggleSimpleWatch(f.id)}
          style={{ flex: 1 }}
        />
        <Button
          label="조건 설정"
          kind="secondary"
          disabled={push !== 'ready'}
          onPress={() => router.push({ pathname: '/alert', params: { facility: f.id } })}
        />
      </SafeAreaView>
    </View>
  );
}

function ListingRow({ listing: l, first }: { listing: Listing; first: boolean }) {
  const c = useColors();
  const active = tone(l.status) !== 'off';
  const note = receiptNote(l);
  return (
    <Pressable
      disabled={!l.url}
      onPress={() => router.push({ pathname: '/booking', params: { url: l.url!, title: l.title } })}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: c.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.6 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityHint="서울시 예약 화면을 엽니다"
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.rowTitle, { color: active ? c.text : c.sub }]}>
          {bandLabel(l)}
          <Text style={[styles.meta, { color: c.sub }]}>  {period(l)}</Text>
        </Text>
        <Text style={[styles.meta, { color: c.sub }]} numberOfLines={1}>
          {[l.paid === false ? '무료' : l.price_note, note].filter(Boolean).join(' · ') || l.title}
        </Text>
      </View>
      <StatusPill status={l.status} />
      <Ionicons name="open-outline" size={16} color={c.faint} />
    </Pressable>
  );
}

function InfoLine({ icon, text, onPress }: { icon: 'location-outline' | 'call-outline'; text: string; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.info}>
      <Ionicons name={icon} size={18} color={c.sub} />
      <Text style={{ color: onPress ? c.accentText : c.text, flex: 1 }}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 16 / 9 },
  head: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, gap: 4 },
  district: { fontSize: 13 },
  name: { fontSize: 24, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  notice: { flexDirection: 'row', gap: 6, padding: 12, borderRadius: 12, marginTop: 10 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  bottom: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
