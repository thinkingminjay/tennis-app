// Stage 0 spike (docs/POC.md): list open API listings from Supabase and open the
// Seoul booking page in a plain WebView popup. The user logs in and books by themselves.
// No injected JS, no message bridge, no cookie access (CLAUDE.md "확인 사항").

import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

interface Listing {
  svc_id: string;
  title: string;
  status: string | null;
  day_type: string | null;
  time_band: string | null;
  period_start: string | null;
  period_end: string | null;
  url: string | null;
  updated_at: string;
  court: { label: string } | null;
  facility: { name: string; district: string | null };
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const RECEIVING = '접수중';

async function fetchListings(): Promise<Listing[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('apps/mobile/.env에 Supabase 값이 없습니다');
  const select = 'svc_id,title,status,day_type,time_band,period_start,period_end,url,updated_at,court(label),facility(name,district)';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listing?select=${encodeURIComponent(select)}&order=svc_id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`불러오기 실패 (HTTP ${res.status})`);
  return res.json();
}

function minutesAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}분 전 갱신` : `${Math.round(m / 60)}시간 전 갱신`;
}

export default function App() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Listing | null>(null);

  useEffect(() => {
    fetchListings().then(setListings, (e) => setError(String(e.message ?? e)));
  }, []);

  const sections = groupByFacility(listings ?? []);
  const latest = listings?.reduce((a, l) => (l.updated_at > a ? l.updated_at : a), '');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.title}>서울 테니스장</Text>
          {latest ? <Text style={styles.meta}>{minutesAgo(latest)}</Text> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!listings && !error ? <ActivityIndicator style={{ marginTop: 40 }} /> : null}

        <SectionList
          sections={sections}
          keyExtractor={(l) => l.svc_id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.facility}>
              {section.title}
              <Text style={styles.meta}>  {section.district ?? ''}</Text>
            </Text>
          )}
          renderItem={({ item }) => <ListingRow listing={item} onPress={() => item.url && setOpen(item)} />}
          ListFooterComponent={
            <Text style={styles.footer}>비공식 앱 · 출처: 서울특별시 (공공누리 제1유형)</Text>
          }
        />

        <Modal visible={open !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
          <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.sheetHeader}>
              <Text style={styles.notice}>서울시 예약 화면입니다. 예약은 직접 진행해 주세요</Text>
              <Pressable onPress={() => setOpen(null)} hitSlop={12} accessibilityRole="button">
                <Text style={styles.close}>닫기</Text>
              </Pressable>
            </View>
            {open?.url ? (
              <WebView
                source={{ uri: open.url }}
                startInLoadingState
                renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} />}
              />
            ) : null}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ListingRow({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const receiving = listing.status === RECEIVING;
  const tags = [listing.court?.label, listing.day_type, listing.time_band].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {tags || listing.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {listing.period_start} ~ {listing.period_end}
        </Text>
      </View>
      <Text style={[styles.chip, receiving ? styles.chipOn : styles.chipOff]}>{listing.status}</Text>
    </Pressable>
  );
}

function groupByFacility(listings: Listing[]) {
  const map = new Map<string, { title: string; district: string | null; data: Listing[] }>();
  for (const l of listings) {
    const key = l.facility.name;
    if (!map.has(key)) map.set(key, { title: key, district: l.facility.district, data: [] });
    map.get(key)!.data.push(l);
  }
  // Facilities with open listings first.
  return [...map.values()].sort(
    (a, b) =>
      Number(b.data.some((l) => l.status === RECEIVING)) - Number(a.data.some((l) => l.status === RECEIVING)) ||
      a.title.localeCompare(b.title, 'ko'),
  );
}

const ACCENT = '#1F7A4D';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  meta: { fontSize: 12, color: '#888', fontWeight: '400' },
  error: { color: '#C0392B', paddingHorizontal: 16 },
  facility: { fontSize: 16, fontWeight: '600', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowTitle: { fontSize: 15 },
  chip: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  chipOn: { backgroundColor: ACCENT, color: '#fff' },
  chipOff: { backgroundColor: '#EEE', color: '#888' },
  footer: { fontSize: 11, color: '#999', textAlign: 'center', padding: 24 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  notice: { flex: 1, fontSize: 13, color: '#555' },
  close: { fontSize: 15, fontWeight: '600', color: ACCENT },
});
