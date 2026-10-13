// 지도: a pin per facility, green when it has a 접수중 listing. Tap a pin for a card, tap the card for detail.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Facility } from '../../api';
import { useData } from '../../data';
import { RECEIVING } from '../../format';
import { useColors } from '../../theme';
import { CountBadge, Ionicons } from '../../ui';

const OFF = '#9AA0A6';

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
            <CourtIcon color={openCount.get(f.id) ? c.accent : OFF} selected={selected?.id === f.id} />
          </Marker>
        ))}
      </MapView>

      <View style={[styles.legend, { backgroundColor: c.bg }]}>
        <CourtIcon color={c.accent} />
        <Text style={[styles.legendText, { color: c.text }]}>접수중 있음</Text>
        <CourtIcon color={OFF} />
        <Text style={[styles.legendText, { color: c.text }]}>없음</Text>
        {missing ? <Text style={[styles.legendText, { color: c.sub }]}>· 위치 없음 {missing}곳</Text> : null}
      </View>

      {selected ? (
        <Pressable
          onPress={() => router.push(`/facility/${selected.id}`)}
          style={({ pressed }) => [styles.card, { backgroundColor: c.bg, opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.name, { color: c.text }]}>{selected.name}</Text>
            <Text style={{ color: c.sub }}>
              {selected.district} · 상품 {(listingsByFacility.get(selected.id) ?? []).length}개
            </Text>
            {openCount.get(selected.id) ? <CountBadge status={RECEIVING} count={openCount.get(selected.id)!} /> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

// A tiny top-down tennis court: coloured surface, white outline, net across the middle.
function CourtIcon({ color, selected }: { color: string; selected?: boolean }) {
  const scale = selected ? 1.3 : 1;
  return (
    <View style={[styles.court, { backgroundColor: color, transform: [{ scale }] }]}>
      <View style={styles.courtLines}>
        <View style={styles.net} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  court: { width: 20, height: 30, borderRadius: 3, padding: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
  courtLines: { flex: 1, borderWidth: 1.5, borderColor: '#fff', justifyContent: 'center' },
  net: { height: 1.5, backgroundColor: '#fff' },
  legend: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  name: { fontSize: 17, fontWeight: '700' },
});
