import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, Card, colors, Header } from '../../components/ui';
import { capPeriodKey, isActiveOn, isEligible, upcomingDays, type PlanDay } from '../../lib/benefits/eligibility';
import type { PromoCategory, Promotion } from '../../lib/benefits/types';
import { apiOrigin } from '../../lib/client/api';
import { dayLabel, merchantName, money, promoConditions, promoHeadline } from '../../lib/client/format';
import { useSettings } from '../../lib/client/profile';
import { cancelReminders, reminderMessage, remindPromoWeekly } from '../../lib/client/reminders';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES: { id: PromoCategory | 'todas'; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'supermercado', label: 'Súper' },
  { id: 'farmacia', label: 'Farmacia' },
  { id: 'combustible', label: 'Nafta' },
  { id: 'comercios', label: 'Comercios' },
];

export default function WeekScreen() {
  const { settings } = useSettings();
  const days = useMemo(() => upcomingDays(), []);
  const [dayIndex, setDayIndex] = useState(0);
  const [category, setCategory] = useState<PromoCategory | 'todas'>('todas');
  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [updated, setUpdated] = useState('');
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
      <StatusBar barStyle="light-content" />
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

          {notice ? (
            <Pressable onPress={() => setNotice(null)}>
              <Card style={{ backgroundColor: colors.goodBg }}>
                <Text style={{ color: colors.good, fontWeight: '600' }}>{notice}</Text>
              </Card>
            </Pressable>
          ) : null}
          {error ? <Text style={styles.empty}>No se pudieron cargar las promos.</Text> : null}
          {!promotions && !error ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.brand} /> : null}
          {promotions && visible.length === 0 ? <Text style={styles.empty}>Ninguna promo con tus medios este día.</Text> : null}

          {visible.map((p) => (
            <Card key={p.id}>
              <View style={styles.cardTop}>
                <Text style={styles.merchants}>{p.merchants.map(merchantName).join(' · ')}</Text>
                <ReminderBell promo={p} onMessage={setNotice} />
                <Badge label={`${p.discountPct}%`} tone="good" />
              </View>
              <Text style={styles.headline}>{promoHeadline(p)}</Text>
              {p.payment ? <Text style={styles.detail}>{p.payment}</Text> : null}
              <Text style={styles.detail}>{promoConditions(p)}</Text>
              {p.notes ? <Text style={styles.detail}>{p.notes}</Text> : null}
              <CapMeter promo={p} day={days[dayIndex]} />
              <View style={styles.cardBottom}>
                {expiresSoon(p, days) ? <Badge label={`Vence ${p.validUntil!.split('-').reverse().slice(0, 2).join('/')}`} tone="warn" /> : null}
                {p.origin === 'coto-live' ? <Badge label="En vivo de Coto" tone="brand" /> : null}
                {p.origin === 'banco-live' ? <Badge label="Del sitio del banco" tone="brand" /> : null}
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

/** Weekly 9:00 reminder on the promo's days; tap again to cancel. */
function ReminderBell({ promo, onMessage }: { promo: Promotion; onMessage: (text: string) => void }) {
  const { settings, update } = useSettings();
  const ids = settings.promoReminders[promo.id];

  const toggle = async () => {
    const { [promo.id]: _, ...others } = settings.promoReminders;
    if (ids) {
      await cancelReminders(ids).catch(() => {});
      update({ promoReminders: others });
      onMessage('Recordatorio cancelado.');
      return;
    }
    const title = `${promo.discountPct}% en ${promo.merchants.map(merchantName).join(', ')}`;
    const { result, ids: scheduled } = await remindPromoWeekly(promo, title, promoHeadline(promo)).catch(() => ({ result: 'unsupported' as const, ids: [] }));
    if (result === 'scheduled') update({ promoReminders: { ...others, [promo.id]: scheduled } });
    onMessage(reminderMessage(result, 'cada semana ese día'));
  };

  return (
    <Pressable onPress={toggle} hitSlop={8} style={{ marginTop: 2 }}>
      <Ionicons name={ids ? 'notifications' : 'notifications-outline'} size={20} color={ids ? colors.brand : colors.faint} />
    </Pressable>
  );
}

/** Ends within the week shown: worth using before it's gone. */
function expiresSoon(p: Promotion, days: PlanDay[]): boolean {
  return p.validUntil !== undefined && p.validUntil <= days[days.length - 1].date;
}

/** How much of a monthly/weekly cap is left, editable so the planner knows what was already used. */
function CapMeter({ promo, day }: { promo: Promotion; day: PlanDay }) {
  const { settings, update } = useSettings();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const key = capPeriodKey(promo, day);
  if (!key || !promo.cap) return null;

  const used = settings.capUsage[key] ?? 0;
  const save = () => {
    const amount = Math.max(0, Number(draft.replace(/[^0-9]/g, '')) || 0);
    update({ capUsage: { ...settings.capUsage, [key]: amount } });
    setEditing(false);
  };

  return (
    <View style={styles.cap}>
      <View style={styles.capBar}>
        <View style={[styles.capFill, { width: `${Math.min(100, (used / promo.cap.amount) * 100)}%` }]} />
      </View>
      {editing ? (
        <View style={styles.capEdit}>
          <Text style={styles.detail}>Ya usé $</Text>
          <TextInput style={styles.capInput} keyboardType="numeric" value={draft} onChangeText={setDraft} onSubmitEditing={save} autoFocus />
          <Pressable onPress={save}>
            <Text style={styles.link}>Guardar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => { setDraft(String(used)); setEditing(true); }}>
          <Text style={styles.detail}>
            Te quedan {money(promo.cap.amount - Math.min(used, promo.cap.amount))} de {money(promo.cap.amount)} {promo.cap.per === 'mes' ? 'este mes' : 'esta semana'} · <Text style={styles.link}>Editar</Text>
          </Text>
        </Pressable>
      )}
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
  cap: { marginTop: 8 },
  capBar: { height: 6, borderRadius: 3, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  capFill: { height: 6, backgroundColor: colors.warn },
  capEdit: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  capInput: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 90, color: colors.text },
});
