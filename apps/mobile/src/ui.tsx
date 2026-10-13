import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tone, type Tone } from './format';
import { useColors, type Colors } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

function toneColors(c: Colors, t: Tone) {
  if (t === 'open') return { fg: c.accent, bg: c.accentSoft };
  if (t === 'soon') return { fg: c.soon, bg: c.soonSoft };
  return { fg: c.off, bg: c.offSoft };
}

export function StatusPill({ status }: { status: string | null }) {
  const c = useColors();
  const { fg, bg } = toneColors(c, tone(status));
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{status ?? '알 수 없음'}</Text>
    </View>
  );
}

export function CountBadge({ count, status }: { count: number; status: string }) {
  const c = useColors();
  const { fg, bg } = toneColors(c, tone(status));
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>
        {status} {count}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        s.chip,
        { borderColor: selected ? c.text : c.border, backgroundColor: selected ? c.text : c.bg },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[s.chipText, { color: selected ? c.bg : c.text }]}>{label}</Text>
      {icon ? <Ionicons name={icon} size={14} color={selected ? c.bg : c.sub} /> : null}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? 'transparent' : c.surface;
  const fg = kind === 'primary' ? c.onAccent : kind === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={s.sectionRow}>
      <Text style={[s.section, { color: c.text }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  const c = useColors();
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={32} color={c.faint} />
      <Text style={[s.emptyTitle, { color: c.text }]}>{title}</Text>
      {body ? <Text style={[s.emptyBody, { color: c.sub }]}>{body}</Text> : null}
    </View>
  );
}

export function SourceFooter() {
  const c = useColors();
  return <Text style={[s.footer, { color: c.faint }]}>비공식 앱 · 출처: 서울특별시 (공공누리 제1유형)</Text>;
}

const s = StyleSheet.create({
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  section: { fontSize: 17, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  footer: { fontSize: 11, textAlign: 'center', padding: 24 },
});
