// 내 정보: favorites, quiet hours, booking-page login,  data freshness, source and unofficial notice.

import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useData } from '../../data';
import { minutesAgo } from '../../format';
import { useColors } from '../../theme';
import { Card, Empty, Ionicons, SectionTitle } from '../../ui';

export default function Me() {
  const c = useColors();
  const { favorites, facilityById, toggleFavorite, quiet, toggleQuiet, push, updatedAt, keepLogin, setKeepLogin } = useData();
  const favs = [...favorites].map((id) => facilityById.get(id)).filter((f) => !!f);

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ paddingBottom: 32 }}>
      <SectionTitle>즐겨찾기</SectionTitle>
      {favs.length === 0 ? (
        <Empty icon="star-outline" title="즐겨찾기한 테니스장이 없어요" body="테니스장 상세 오른쪽 위 별을 누르면 홈 목록 맨 위에 보여요." />
      ) : (
        <Card style={styles.group}>
          {favs.map((f, i) => (
            <Pressable key={f.id} onPress={() => router.push(`/facility/${f.id}`)} style={[styles.row, divider(c.border, i)]}>
              <Text style={[styles.label, { color: c.text }]}>{f.name}</Text>
              <Pressable onPress={() => toggleFavorite(f.id)} hitSlop={10} accessibilityLabel="즐겨찾기 해제">
                <Ionicons name="star" size={20} color={c.soon} />
              </Pressable>
            </Pressable>
          ))}
        </Card>
      )}

      <SectionTitle>알림</SectionTitle>
      <Card style={styles.group}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: c.text }]}>방해금지 시간</Text>
            <Text style={{ color: c.sub, fontSize: 13 }}>밤 11시~아침 7시에는 알림을 보내지 않아요</Text>
          </View>
          <Switch value={quiet} onValueChange={toggleQuiet} disabled={push !== 'ready'} trackColor={{ true: c.accent }} />
        </View>
      </Card>

      <SectionTitle>예약 화면</SectionTitle>
      <Card style={styles.group}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: c.text }]}>로그인 유지</Text>
            <Text style={{ color: c.sub, fontSize: 13 }}>
              {keepLogin
                ? '예약 화면에서 한 번 로그인하면 다음에도 이어져요'
                : '예약 화면을 열 때마다 새로 로그인해요. 기기에 로그인 정보가 남지 않아요'}
            </Text>
          </View>
          <Switch value={keepLogin} onValueChange={setKeepLogin} trackColor={{ true: c.accent }} />
        </View>
      </Card>

      <SectionTitle>정보</SectionTitle>
      <Card style={styles.group}>
        <Line label="데이터 갱신" value={minutesAgo(updatedAt) || '-'} />
        <Line label="데이터 출처" value="서울특별시 공공데이터 (공공누리 제1유형)" divided />
      </Card>
      <Text style={[styles.note, { color: c.sub }]}>
        이 앱은 서울시와 관계없는 비공식 앱이에요. 예약·결제는 서울시 예약 화면에서 직접 진행하며, 앱은 아이디·비밀번호를 받거나
        예약 화면 내용을 읽지 않아요.
      </Text>
    </ScrollView>
  );
}

const divider = (color: string, index: number) => ({ borderTopColor: color, borderTopWidth: index ? StyleSheet.hairlineWidth : 0 });

function Line({ label, value, divided }: { label: string; value: string; divided?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.row, divider(c.border, divided ? 1 : 0)]}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <Text style={{ color: c.sub, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  label: { fontSize: 15, flex: 1 },
  note: { fontSize: 13, lineHeight: 19, paddingHorizontal: 20, paddingTop: 16 },
});
