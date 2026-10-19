import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, colors, Header, SectionTitle } from '../../components/ui';
import { apiOrigin } from '../../lib/client/api';
import { dayLabel, merchantName, money, promoConditions, promoHeadline } from '../../lib/client/format';
import { usePersistentState, useSettings } from '../../lib/client/profile';
import type { PlanResponse } from '../../lib/planner/service';
import { storeName } from '../../lib/stores/registry';

const PLACEHOLDER = 'Escribí lo que necesitás, uno por línea:\n2 leche entera 1l\nyerba 1kg\nibuprofeno 400\nnafta';
/** ARS a store visit has to save to be worth it when "menos paradas" is on. */
const FEWER_STOPS_PENALTY = 3000;

export default function ListScreen() {
  const { settings, update } = useSettings();
  const [text, setText] = usePersistentState('azoapp.list.v1', '');
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiOrigin()}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sources: settings.sources,
          audiences: settings.audiences,
          stores: settings.stores,
          storePenalty: settings.fewerStops ? FEWER_STOPS_PENALTY : 0,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Error al planificar');
      setPlan(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Header eyebrow="Dónde y cuándo comprar" title="Mi lista" subtitle={`Con tus ${settings.sources.length} bancos, tarjetas y billeteras`} />

        <View style={styles.body}>
          <Card>
            <TextInput
              style={[styles.input, { height: Math.max(140, (text.split('\n').length + 1) * 22) }]}
              multiline
              placeholder={PLACEHOLDER}
              placeholderTextColor={colors.faint}
              value={text}
              onChangeText={setText}
              textAlignVertical="top"
            />
            <View style={styles.row}>
              <View style={styles.switchRow}>
                <Switch value={settings.fewerStops} onValueChange={(v) => update({ fewerStops: v })} />
                <Text style={styles.switchLabel}>Menos paradas</Text>
              </View>
              <Pressable
                onPress={runPlan}
                disabled={loading || text.trim().length === 0}
                style={({ pressed }) => [styles.button, (pressed || loading) && { opacity: 0.8 }, text.trim().length === 0 && { opacity: 0.4 }]}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Planificar</Text>}
              </Pressable>
            </View>
            {loading ? <Text style={styles.hint}>Buscando precios en {settings.stores.length} cadenas…</Text> : null}
          </Card>

          {error ? (
            <Card style={{ backgroundColor: '#fef2f2' }}>
              <Text style={{ color: '#991b1b' }}>{error}</Text>
            </Card>
          ) : null}

          {plan ? <PlanView plan={plan} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function PlanView({ plan }: { plan: PlanResponse }) {
  const savings = plan.listTotal - plan.total;
  const failed = plan.storesFailed.length;

  return (
    <>
      <Card style={styles.summary}>
        <Text style={styles.summaryLabel}>Total estimado</Text>
        <Text style={styles.summaryTotal}>{money(plan.total)}</Text>
        <Text style={styles.summaryNote}>
          {savings > 0 ? `Ahorrás ${money(savings)} con tus promos · ` : ''}
          {plan.stops.length} {plan.stops.length === 1 ? 'parada' : 'paradas'}
        </Text>
        {failed > 0 ? (
          <Text style={styles.summaryWarn}>
            Sin respuesta de: {plan.storesFailed.map(storeName).join(', ')}
          </Text>
        ) : null}
      </Card>

      {plan.stops.length > 0 ? <SectionTitle>Por tienda</SectionTitle> : null}
      {plan.stops.map((stop) => (
        <Card key={stop.store}>
          <View style={styles.stopHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stopStore}>{storeName(stop.store)}</Text>
              <Text style={styles.stopDay}>Comprá {dayLabel(stop.day, plan.days)}</Text>
            </View>
            <Text style={styles.stopTotal}>{money(stop.total)}</Text>
          </View>

          {stop.promotion ? (
            <View style={styles.promoBox}>
              <Badge label={`−${money(stop.promotion.discount)} · ${promoHeadline(stop.promotion.promotion)}`} tone="good" />
              <Text style={styles.promoDetail}>
                {stop.promotion.promotion.payment ? `${stop.promotion.promotion.payment}. ` : ''}
                {promoConditions(stop.promotion.promotion)}
              </Text>
              {stop.promotion.promotion.confidence === 'verificar' ? (
                <Text style={styles.verify}>⚠ Verificá en la app antes de pagar</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.promoDetail}>Sin promo con tus medios esta semana.</Text>
          )}

          {stop.lines.map((line) => (
            <Pressable key={line.itemIndex} style={styles.line} onPress={() => Linking.openURL(line.offer.url)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineQuery}>
                  {line.item.quantity > 1 ? `${line.item.quantity}× ` : ''}
                  {line.item.query}
                </Text>
                <Text style={styles.lineProduct} numberOfLines={1}>
                  {line.isSubstitute ? '≈ ' : ''}
                  {line.offer.name}
                </Text>
              </View>
              <Text style={styles.linePrice}>{money(line.listCost)}</Text>
            </Pressable>
          ))}

          <OtherDays stop={stop} days={plan.days} />
        </Card>
      ))}

      {plan.notFound.length > 0 ? <SectionTitle>No encontrado en las cadenas</SectionTitle> : null}
      {plan.notFound.map((index) => (
        <Card key={index}>
          <Text style={styles.lineQuery}>{plan.items[index].item.query}</Text>
          {(plan.hints[index] ?? []).length > 0 ? (
            plan.hints[index].map((p) => (
              <Text key={p.id} style={styles.promoDetail}>
                • {p.merchants.map(merchantName).join(', ')}: {promoHeadline(p)} — {promoConditions(p)}
              </Text>
            ))
          ) : (
            <Text style={styles.promoDetail}>Probá con otra descripción (marca, tamaño).</Text>
          )}
        </Card>
      ))}

      {plan.items.some((i) => i.best) ? <SectionTitle>Por producto</SectionTitle> : null}
      {plan.items.map((itemPlan, i) =>
        itemPlan.best ? (
          <Card key={i}>
            <Text style={styles.lineQuery}>{itemPlan.item.query}</Text>
            <Text style={styles.itemBest}>
              Mejor: {storeName(itemPlan.best.store)} {dayLabel(itemPlan.best.day, plan.days)} · {money(itemPlan.best.cost)}
              {itemPlan.best.promotion ? ` (${itemPlan.best.promotion.promotion.discountPct}% off)` : ''}
            </Text>
            {itemPlan.bestToday && itemPlan.bestToday.cost > itemPlan.best.cost + 0.5 ? (
              <Text style={styles.promoDetail}>
                Hoy: {storeName(itemPlan.bestToday.store)} · {money(itemPlan.bestToday.cost)}
              </Text>
            ) : null}
            <Text style={styles.promoDetail} numberOfLines={2}>
              {itemPlan.options
                .slice(1, 4)
                .map((o) => `${storeName(o.store)} ${money(o.cost)}`)
                .join(' · ')}
            </Text>
          </Card>
        ) : null,
      )}

      {plan.oneStop.length > 0 ? <SectionTitle>Todo en un solo lugar</SectionTitle> : null}
      {plan.oneStop.slice(0, 3).map((o) => (
        <Card key={o.store}>
          <View style={styles.stopHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stopStore}>{storeName(o.store)}</Text>
              <Text style={styles.stopDay}>
                {dayLabel(o.day, plan.days)}
                {o.missing > 0 ? ` · faltan ${o.missing}` : ' · tiene todo'}
              </Text>
            </View>
            <Text style={styles.stopTotal}>{money(o.total)}</Text>
          </View>
        </Card>
      ))}
    </>
  );
}

function OtherDays({ stop, days }: { stop: PlanResponse['stops'][number]; days: PlanResponse['days'] }) {
  const [open, setOpen] = useState(false);
  const differs = stop.byDay.some((q) => Math.abs(q.total - stop.total) > 0.5);
  if (!differs) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Pressable onPress={() => setOpen(!open)} style={styles.otherDaysToggle}>
        <Text style={styles.otherDaysText}>Si no podés ese día</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
      </Pressable>
      {open
        ? stop.byDay.map((q) => (
            <View key={q.day.date} style={styles.dayRow}>
              <Text style={styles.dayRowLabel}>{dayLabel(q.day, days)}</Text>
              <Text style={styles.dayRowValue}>{money(q.total)}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16 },
  input: { minHeight: 140, fontSize: 15, color: colors.text, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { color: colors.muted, fontWeight: '600' },
  button: { backgroundColor: colors.brand, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { color: colors.faint, marginTop: 8, fontSize: 12 },
  summary: { backgroundColor: colors.ink },
  summaryLabel: { color: colors.faint, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  summaryTotal: { color: '#fff', fontSize: 34, fontWeight: '900' },
  summaryNote: { color: '#cbd5e1', marginTop: 2 },
  summaryWarn: { color: '#fcd34d', marginTop: 6, fontSize: 12 },
  stopHeader: { flexDirection: 'row', alignItems: 'center' },
  stopStore: { fontSize: 18, fontWeight: '800', color: colors.ink },
  stopDay: { fontSize: 14, color: colors.brand, fontWeight: '700', marginTop: 2 },
  stopTotal: { fontSize: 20, fontWeight: '900', color: colors.ink },
  promoBox: { marginTop: 10, gap: 4 },
  promoDetail: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  verify: { color: colors.warn, fontSize: 12, fontWeight: '600' },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 8 },
  lineQuery: { fontWeight: '700', color: colors.text, fontSize: 15 },
  lineProduct: { color: colors.muted, fontSize: 12, marginTop: 1 },
  linePrice: { fontWeight: '700', color: colors.text, marginLeft: 8 },
  itemBest: { color: colors.good, fontWeight: '700', marginTop: 4 },
  otherDaysToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  otherDaysText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  dayRowLabel: { color: colors.muted, fontSize: 13 },
  dayRowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
