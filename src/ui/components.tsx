import { PropsWithChildren, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors, Palette } from './theme';

export function Button({ children, onPress, secondary = false, disabled = false, label }: PropsWithChildren<{ onPress: () => void; secondary?: boolean; disabled?: boolean; label?: string }>) {
  const s = useStyles();
  const c = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}><Text style={[s.buttonText, secondary && { color: c.green }]}>{children}</Text></Pressable>;
}
export function Field({ label, value, onChange, placeholder, multiline = false, keyboardType = 'default', secure = false }: { label: string; value: string; onChange: (text: string) => void; placeholder?: string; multiline?: boolean; secure?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' }) {
  const s = useStyles();
  const c = useColors();
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.muted} secureTextEntry={secure} multiline={multiline} keyboardType={keyboardType} autoCapitalize={secure || keyboardType === 'email-address' ? 'none' : 'sentences'} style={[s.input, multiline && { minHeight: 96, textAlignVertical: 'top' }]} /></View>;
}
export function Card({ children }: PropsWithChildren) {
  const s = useStyles();
  const c = useColors(); return <View style={s.card}>{children}</View>; }
export function EmptyState({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  const s = useStyles();
  const c = useColors();
  return <View style={s.empty}><View style={s.emptyMark}><Text style={{ color: c.green, fontSize: 25 }}>＋</Text></View><Text style={s.title}>{title}</Text><Text style={s.muted}>{description}</Text>{children}</View>;
}
const makeStyles = (c: Palette) => StyleSheet.create({
  card: { backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: c.radius, borderBottomWidth: 1, padding: 24, gap: 16 },
  title: { color: c.ink, fontSize: 20, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 14, lineHeight: 23 },
  label: { color: c.ink, fontSize: 13, fontWeight: '600' },
  field: { gap: 8, flexGrow: 1 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, color: c.ink, fontSize: 15, backgroundColor: c.input, minHeight: 46 },
  button: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 12, borderRadius: Math.round(c.radius / 2), borderBottomWidth: 0, borderColor: c.green, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: c.onAccent, fontWeight: '600', fontSize: 14 },
  secondary: { backgroundColor: c.pale, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  empty: { alignItems: 'center', paddingVertical: 42, paddingHorizontal: 18, gap: 14 },
  emptyMark: { backgroundColor: c.pale, borderRadius: 18, borderWidth: 1, borderColor: c.line, width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  error: { color: c.error, lineHeight: 23, fontSize: 14 },
});

export function useStyles(){ const c=useColors(); return useMemo(()=>makeStyles(c),[c]); }
