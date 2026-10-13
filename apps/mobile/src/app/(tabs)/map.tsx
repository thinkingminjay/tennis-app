// 지도: a court-shaped pin per facility, coloured by court surface and faded when nothing is 접수중.
// Tap a pin for a card, tap the card for detail.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Facility } from '../../api';
import { useData } from '../../data';
import { RECEIVING } from '../../format';
import { useColors } from '../../theme';
import { Ionicons, SplitFill, surfaceColors } from '../../ui';

const SEOUL = { latitude: 37.5565, longitude: 126.9780, latitudeDelta: 0.32, longitudeDelta: 0.32 };

export default function MapTab() {
  const c = useColors();
  const { facilities, listingsByFacility } = useData();
  const [selected, setSelected] = useState<Facility | null>(null);

  const openCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of facilities) m.set(f.id, (listingsByFacility.get(f.id) ?? []).filter((l) => l.status === RECEIVING).length);
    return m;
  }, [facilities, listingsByFacility]);

  const pinned = facilities.filter((f) => f.lat != null && f.lng != null);
  const missing = facilities.length - pinned.length;

  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={SEOUL} showsUserLocation={false} onPress={() => setSelected(null)}>
        {pinned.map((f) => (
          <Marker
            key={selected?.id === f.id ? `${f.id}-on` : f.id}
            coordinate={{ latitude: f.lat!, longitude: f.lng! }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={(e) => {
              e.stopPropagation();
              setSelected(f);
            }}
          >
            <CourtIcon colors={surfaceColors(c, f.surfaces)} dim={!openCount.get(f.id)} selected={selected?.id === f.id} />
          </Marker>
        ))}
      </MapView>

      <View style={[styles.legend, { backgroundColor: c.card }]}>
        <View style={styles.legendRow}>
          <CourtIcon colors={[c.courtHard]} small />
          <Text style={[styles.legendText, { color: c.text }]}>하드</Text>
          <CourtIcon colors={[c.courtClay]} small />
          <Text style={[styles.legendText, { color: c.text }]}>클레이</Text>
          <CourtIcon colors={[c.courtGrass]} small />
          <Text style={[styles.legendText, { color: c.text }]}>인조잔디</Text>
          <CourtIcon colors={[c.courtUnknown]} small />
          <Text style={[styles.legendText, { color: c.text }]}>모름</Text>
        </View>
        <Text style={[styles.legendText, { color: c.sub }]}>
          흐린 핀은 접수중 없음{missing ? ` · 위치 없음 ${missing}곳` : ''}
        </Text>
      </View>

      {selected ? (
        <Pressable
          onPress={() => router.push(`/facility/${selected.id}`)}
          style={({ pressed }) => [styles.card, { backgroundColor: c.card, opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={{ color: c.sub, fontSize: 13 }}>{selected.district}</Text>
          <View style={styles.cardTitle}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {selected.name}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.text} />
          </View>
          <View style={styles.cardFoot}>
            <View style={[styles.ratio, { backgroundColor: c.surface }]}>
              <Text style={{ color: c.sub, fontSize: 13 }}>
                접수중{' '}
                <Text style={{ color: openCount.get(selected.id) ? c.accent : c.sub, fontWeight: '700' }}>
                  {openCount.get(selected.id) ?? 0}
                </Text>
                <Text style={{ color: c.faint }}>/{(listingsByFacility.get(selected.id) ?? []).length}</Text>
              </Text>
            </View>
            <View style={[styles.more, { backgroundColor: c.accent }]}>
              <Text style={{ color: c.onAccent, fontSize: 13, fontWeight: '700' }}>상세 보기</Text>
            </View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

// A tiny top-down tennis court: surface colours side by side, white outline, net across the middle.
function CourtIcon({ colors, dim, selected, small }: { colors: string[]; dim?: boolean; selected?: boolean; small?: boolean }) {
  const scale = selected ? 1.3 : small ? 0.6 : 1;
  return (
    <View style={[styles.court, { opacity: dim && !selected ? 0.45 : 1, transform: [{ scale }] }, small && styles.courtSmall]}>
      <SplitFill colors={colors} />
      <View style={styles.courtLines}>
        <View style={styles.net} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  court: { width: 20, height: 30, borderRadius: 3, padding: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)', overflow: 'hidden' },
  courtSmall: { marginHorizontal: -4, marginVertical: -6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  courtLines: { flex: 1, borderWidth: 1.5, borderColor: '#fff', justifyContent: 'center' },
  net: { height: 1.5, backgroundColor: '#fff' },
  legend: {
    position: 'absolute',
    top: 12,
    left: 12,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  legendText: { fontSize: 12 },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 2,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  name: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  ratio: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  more: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
});
