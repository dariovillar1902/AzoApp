import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, colors, Header } from '../../components/ui';
import { isActiveOn, isEligible, upcomingDays } from '../../lib/benefits/eligibility';
import type { PromoCategory, Promotion } from '../../lib/benefits/types';
import { apiOrigin } from '../../lib/client/api';
import { dayLabel, merchantName, promoConditions, promoHeadline } from '../../lib/client/format';
import { useSettings } from '../../lib/client/profile';

const CATEGORIES: { id: PromoCategory | 'todas'; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'supermercado', label: 'Súper' },
  { id: 'farmacia', label: 'Farmacia' },
  { id: 'combustible', label: 'Nafta' },
];

export default function WeekScreen() {
  const { settings } = useSettings();
  const days = useMemo(() => upcomingDays(), []);
  const [dayIndex, setDayIndex] = useState(0);
  const [category, setCategory] = useState<PromoCategory | 'todas'>('todas');
  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [updated, setUpdated] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${apiOrigin()}/api/promos`)
      .then((r) => r.json())
      .then((json) => {
        setPromotions(json.promotions);
        setUpdated(json.updated);
      })
      .catch(() => setError(true));
  }, []);

  const visible = useMemo(() => {
    if (!promotions) return [];
    const day = days[dayIndex];
    return promotions
      .filter((p) => isEligible(p, settings) && isActiveOn(p, day))
      .filter((p) => category === 'todas' || p.category === category)
      .sort((a, b) => b.discountPct - a.discountPct);
  }, [promotions, settings, dayIndex, category, days]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Header eyebrow="Tus promos" title="Esta semana" subtitle={updated ? `Catálogo revisado el ${updated.split('-').reverse().join('/')}` : undefined}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
            {days.map((d, i) => (
              <Pressable key={d.date} onPress={() => setDayIndex(i)} style={[styles.dayPill, i === dayIndex && styles.dayPillOn]}>
                <Text style={[styles.dayPillText, i === dayIndex && styles.dayPillTextOn]}>{dayLabel(d, days)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Header>

        <View style={styles.body}>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable key={c.id} onPress={() => setCategory(c.id)} style={[styles.chip, category === c.id && styles.chipOn]}>
                <Text style={[styles.chipText, category === c.id && styles.chipTextOn]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.empty}>No se pudieron cargar las promos.</Text> : null}
          {!promotions && !error ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.brand} /> : null}
          {promotions && visible.length === 0 ? <Text style={styles.empty}>Ninguna promo con tus medios este día.</Text> : null}

          {visible.map((p) => (
            <Card key={p.id}>
              <View style={styles.cardTop}>
                <Text style={styles.merchants}>{p.merchants.map(merchantName).join(' · ')}</Text>
                <Badge label={`${p.discountPct}%`} tone="good" />
              </View>
              <Text style={styles.headline}>{promoHeadline(p)}</Text>
              {p.payment ? <Text style={styles.detail}>{p.payment}</Text> : null}
              <Text style={styles.detail}>{promoConditions(p)}</Text>
              {p.notes ? <Text style={styles.detail}>{p.notes}</Text> : null}
              <View style={styles.cardBottom}>
                {p.origin === 'coto-live' ? <Badge label="En vivo de Coto" tone="brand" /> : null}
                {p.confidence === 'verificar' ? <Badge label="Verificar" tone="warn" /> : <Badge label="Confirmada" tone="brand" />}
                {p.sourceUrl ? (
                  <Pressable onPress={() => Linking.openURL(p.sourceUrl!)}>
                    <Text style={styles.link}>Fuente</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16 },
  dayPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 8 },
  dayPillOn: { backgroundColor: '#ffffff' },
  dayPillText: { color: '#cbd5e1', fontWeight: '700', textTransform: 'capitalize' },
  dayPillTextOn: { color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: '#475569', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  empty: { color: colors.faint, textAlign: 'center', marginTop: 32 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  merchants: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.ink },
  headline: { color: colors.text, fontWeight: '700', marginTop: 4 },
  detail: { color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  link: { color: colors.brand, fontWeight: '700', fontSize: 12 },
});
