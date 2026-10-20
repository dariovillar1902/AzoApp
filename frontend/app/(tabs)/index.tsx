import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AlternativesModal, type AlternativesTarget } from '../../components/AlternativesModal';
import { ScannerModal } from '../../components/ScannerModal';
import { Badge, Card, colors, Header, SectionTitle } from '../../components/ui';
import { capPeriodKey } from '../../lib/benefits/eligibility';
import { offerKey, offerNameKey } from '../../lib/core/exclusions';
import { normalizeText } from '../../lib/core/normalize';
import { apiOrigin } from '../../lib/client/api';
import { dayLabel, merchantName, money, promoConditions, promoHeadline, unitPrice } from '../../lib/client/format';
import { usePersistentJson, usePersistentState, useSettings, type Refinement } from '../../lib/client/profile';
import { priceInsight, recordPlan, type PriceHistory } from '../../lib/client/priceHistory';
import { planToText } from '../../lib/client/shareText';
import { reminderMessage, remindVisit } from '../../lib/client/reminders';
import { parseShoppingList } from '../../lib/planner/parseList';
import type { PlanResponse } from '../../lib/planner/service';
import { directionsUrl, type Branch } from '../../lib/stores/branches';
import { STORES, storeName } from '../../lib/stores/registry';
import type { OtherShop } from '../../lib/planner/otherShops';
import { sourceName } from '../../lib/benefits/sources';
import * as Location from 'expo-location';
import type { ProductOffer, StoreId } from '../../lib/types';

type Stop = PlanResponse['stops'][number];
type Line = Stop['lines'][number];

const refinementKey = (query: string) => normalizeText(query);

const PLACEHOLDER = 'Escribí lo que necesitás, uno por línea:\n2 leche entera 1l\nyerba 1kg\nfilet de merluza\nibuprofeno 400\nnafta $40000';
/** ARS a store visit has to save to be worth it when "menos paradas" is on. */
const FEWER_STOPS_PENALTY = 3000;

export default function ListScreen() {
  const { settings, update } = useSettings();
  const [text, setText] = usePersistentState('azoapp.list.v1', '');
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState<(AlternativesTarget & { itemQuery: string }) | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [branches, setBranches] = useState<Partial<Record<StoreId, Branch>>>({});

  const loadBranches = async (location: { lat: number; lon: number }) => {
    try {
      const json = await fetch(`${apiOrigin()}/api/branches?lat=${location.lat}&lon=${location.lon}`).then((r) => r.json());
      if (json.branches) setBranches(json.branches);
    } catch {
      // Nearby branches are a nice-to-have; the plan stands without them.
    }
  };

  const locateMe = async () => {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setNotice('Sin permiso de ubicación: activalo en Ajustes → AzoApp (o Expo Go) → Ubicación.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const location = { lat: position.coords.latitude, lon: position.coords.longitude };
      update({ location });
      await loadBranches(location);
      setNotice('Listo: te muestro la sucursal más cercana de cada cadena.');
    } catch {
      setNotice('No se pudo obtener tu ubicación.');
    }
  };
  const [history, updateHistory] = usePersistentJson<PriceHistory>('azoapp.prices.v1', {});

  // `refinements` is passed explicitly after a correction because settings update asynchronously.
  const runPlan = async (refinements = settings.refinements) => {
    setLoading(true);
    setError(null);
    try {
      const items = parseShoppingList(text).map((item) => ({ ...item, ...refinements[refinementKey(item.query)] }));
      const response = await fetch(`${apiOrigin()}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          sources: settings.sources,
          audiences: settings.audiences,
          stores: settings.stores,
          storePenalty: settings.fewerStops ? FEWER_STOPS_PENALTY : 0,
          capUsage: settings.capUsage,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Error al planificar');
      setPlan(json);
      setChecked(new Set());
      updateHistory((prev) => recordPlan(prev, json, json.days[0].date));
      if (settings.location) loadBranches(settings.location);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const refine = (itemQuery: string, change: (current: Refinement) => Refinement) => {
    const key = refinementKey(itemQuery);
    const refinements = { ...settings.refinements, [key]: change(settings.refinements[key] ?? {}) };
    update({ refinements });
    runPlan(refinements);
  };

  const rejectLine = (line: Line) => {
    setNotice(`Descarté "${line.offer.name}" en ${storeName(line.offer.site)}. Buscando otra opción…`);
    refine(line.item.query, (r) => ({
      ...r,
      excludedOfferIds: [...(r.excludedOfferIds ?? []), offerKey(line.offer), offerNameKey(line.offer)],
    }));
  };

  const pickOffer = (offer: ProductOffer) => {
    if (!picking) return;
    const { store, itemQuery } = picking;
    setPicking(null);
    refine(itemQuery, (r) => ({ ...r, queryBySite: { ...r.queryBySite, [store]: offer.name } }));
  };

  /** After paying, count the promo's discount against its cap so later plans don't promise it again. */
  const recordPurchase = (stop: Stop) => {
    const applied = stop.promotion;
    const key = applied && capPeriodKey(applied.promotion, stop.day);
    if (!applied || !key) {
      setNotice(`Listo: ${storeName(stop.store)} marcado como comprado.`);
    } else {
      update({ capUsage: { ...settings.capUsage, [key]: (settings.capUsage[key] ?? 0) + applied.discount } });
      setNotice(`Registrado: usaste ${money(applied.discount)} del tope de ${promoHeadline(applied.promotion)}.`);
    }
    setChecked((prev) => new Set([...prev, ...stop.lines.map((l) => `${stop.store}:${l.itemIndex}`)]));
  };

  const remind = async (stop: Stop) => {
    const promo = stop.promotion;
    const body = promo
      ? `${promoHeadline(promo.promotion)}${promo.promotion.payment ? ` · ${promo.promotion.payment}` : ''}. Ahorro ${money(promo.discount)}.`
      : `${stop.lines.length} productos, ${money(stop.total)}.`;
    const result = await remindVisit(stop.day, `Hoy: ${storeName(stop.store)}`, body).catch(() => 'unsupported' as const);
    setNotice(reminderMessage(result, `el ${dayLabel(stop.day, plan!.days)}`));
  };

  const share = async () => {
    if (!plan) return;
    const message = planToText(plan);
    try {
      if (Platform.OS === 'web' && !(navigator as Navigator & { share?: unknown }).share) {
        await navigator.clipboard.writeText(message);
        setNotice('Plan copiado al portapapeles.');
      } else {
        await Share.share({ message });
      }
    } catch {
      setNotice('No se pudo compartir.');
    }
  };

  const toggleCheck = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const resetRefinements = () => {
    update({ refinements: {} });
    runPlan({});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
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
              <Pressable onPress={() => setScanning(true)} hitSlop={8} style={styles.scanButton}>
                <Ionicons name="barcode-outline" size={24} color={colors.brand} />
              </Pressable>
              <Pressable
                onPress={() => runPlan()}
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

          {notice ? (
            <Pressable onPress={() => setNotice(null)}>
              <Card style={{ backgroundColor: colors.goodBg }}>
                <Text style={{ color: colors.good, fontWeight: '600' }}>{notice}</Text>
              </Card>
            </Pressable>
          ) : null}

          {plan ? (
            <PlanView
              plan={plan}
              history={history}
              branches={branches}
              onLocate={locateMe}
              checked={checked}
              onToggleCheck={toggleCheck}
              onReject={rejectLine}
              onChoose={(stop, line) =>
                setPicking({
                  store: stop.store,
                  query: line.item.queryBySite?.[stop.store] ?? line.item.query,
                  itemQuery: line.item.query,
                  excluded: line.item.excludedOfferIds ?? [],
                })
              }
              onBought={recordPurchase}
              onRemind={remind}
              onShare={share}
              onResetRefinements={Object.keys(settings.refinements).length > 0 ? resetRefinements : undefined}
            />
          ) : null}
        </View>
      </ScrollView>
      <AlternativesModal target={picking} onPick={pickOffer} onClose={() => setPicking(null)} />
      <ScannerModal
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={(code) => {
          setScanning(false);
          setText(text.trim() ? `${text.trimEnd()}\n${code}` : code);
          setNotice(`Código ${code} agregado a la lista.`);
        }}
      />
    </View>
  );
}

interface PlanViewProps {
  plan: PlanResponse;
  history: PriceHistory;
  branches: Partial<Record<StoreId, Branch>>;
  onLocate: () => void;
  checked: Set<string>;
  onToggleCheck: (key: string) => void;
  onReject: (line: Line) => void;
  onChoose: (stop: Stop, line: Line) => void;
  onBought: (stop: Stop) => void;
  onRemind: (stop: Stop) => void;
  onShare: () => void;
  onResetRefinements?: () => void;
}

function PlanView({ plan, history, branches, onLocate, checked, onToggleCheck, onReject, onChoose, onBought, onRemind, onShare, onResetRefinements }: PlanViewProps) {
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
        <View style={styles.summaryActions}>
          <Pressable onPress={onShare} style={styles.summaryAction}>
            <Ionicons name="share-outline" size={16} color="#fff" />
            <Text style={styles.summaryActionText}>Compartir</Text>
          </Pressable>
          <Pressable onPress={onLocate} style={styles.summaryAction}>
            <Ionicons name="location-outline" size={16} color="#fff" />
            <Text style={styles.summaryActionText}>Cerca mío</Text>
          </Pressable>
          {onResetRefinements ? (
            <Pressable onPress={onResetRefinements} style={styles.summaryAction}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.summaryActionText}>Deshacer correcciones</Text>
            </Pressable>
          ) : null}
        </View>
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

          {branches[stop.store] ? (
            <Pressable onPress={() => Linking.openURL(directionsUrl(branches[stop.store]!, Platform.OS))}>
              <Text style={styles.branch}>
                📍 {branches[stop.store]!.address ?? branches[stop.store]!.name} ·{' '}
                {branches[stop.store]!.distanceM < 1000
                  ? `${branches[stop.store]!.distanceM} m`
                  : `${(branches[stop.store]!.distanceM / 1000).toFixed(1)} km`}{' '}
                · <Text style={styles.lineAction}>Cómo llegar</Text>
              </Text>
            </Pressable>
          ) : null}

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

          {stop.lines.map((line) => {
            const key = `${stop.store}:${line.itemIndex}`;
            const done = checked.has(key);
            return (
              <View key={line.itemIndex} style={styles.line}>
                <Pressable onPress={() => onToggleCheck(key)} hitSlop={8} style={styles.check}>
                  <Ionicons name={done ? 'checkbox' : 'square-outline'} size={22} color={done ? colors.good : colors.faint} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Pressable onPress={() => Linking.openURL(line.offer.url)}>
                    <Text style={[styles.lineQuery, done && styles.done]}>
                      {line.item.quantity > 1 ? `${line.item.quantity}× ` : ''}
                      {/^\d{8,14}$/.test(line.item.query) ? `📷 ${line.offer.name}` : line.item.query}
                    </Text>
                    <Text style={styles.lineProduct} numberOfLines={1}>
                      {line.isSubstitute ? '≈ ' : ''}
                      {line.offer.name}
                      {unitPrice(line.offer) ? ` · ${unitPrice(line.offer)}` : ''}
                    </Text>
                  </Pressable>
                  <PriceNote insight={priceInsight(history, line.offer, plan.days[0].date)} />
                  {(() => {
                    const cheaper = (plan.otherShops?.[line.itemIndex] ?? []).find((o) => o.owned && o.cheaper);
                    return cheaper ? (
                      <Text style={styles.cheaperElsewhere}>
                        💡 Más barato en {cheaper.label} {dayLabel(cheaper.day, plan.days)}: ~{money(cheaper.estimatedCost)}
                      </Text>
                    ) : null;
                  })()}
                  {done ? null : (
                    <View style={styles.lineActions}>
                      <Pressable onPress={() => onReject(line)} hitSlop={6}>
                        <Text style={styles.lineAction}>✗ No es esto</Text>
                      </Pressable>
                      <Pressable onPress={() => onChoose(stop, line)} hitSlop={6}>
                        <Text style={styles.lineAction}>Elegir otro</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <Text style={[styles.linePrice, done && styles.done]}>{money(line.listCost)}</Text>
              </View>
            );
          })}

          <OtherDays stop={stop} days={plan.days} />

          <View style={styles.stopActions}>
            {stop.day.date !== plan.days[0].date ? (
              <Pressable onPress={() => onRemind(stop)} style={styles.boughtButton}>
                <Ionicons name="notifications-outline" size={16} color={colors.brand} />
                <Text style={styles.boughtText}>Recordarme</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => onBought(stop)} style={styles.boughtButton}>
              <Ionicons name="bag-check-outline" size={16} color={colors.brand} />
              <Text style={styles.boughtText}>Ya compré acá</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      {plan.notFound.length > 0 ? <SectionTitle>Fuera de las cadenas</SectionTitle> : null}
      {plan.notFound.map((index) => (
        <Card key={index}>
          <Text style={styles.lineQuery}>{plan.items[index].item.query}</Text>
          {(plan.otherShops?.[index] ?? []).length > 0 ? (
            <OtherShopsList shops={plan.otherShops[index]} days={plan.days} />
          ) : (plan.hints[index] ?? []).length > 0 ? (
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
                .map((o) => `${storeName(o.store)} ${money(o.cost)}${unitPrice(o.offer) ? ` (${unitPrice(o.offer)})` : ''}`)
                .join(' · ')}
            </Text>
            <OtherKindOption plan={itemPlan} days={plan.days} />
            {(plan.otherShops?.[i] ?? []).length > 0 ? <OtherShopsList shops={plan.otherShops[i]} days={plan.days} /> : null}
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

const KIND_LABEL = { super: '🛒 En súper', farmacia: '💊 En farmacia', online: '📦 Online' } as const;

/** Best option at each other kind of store: the pharmacy when a supermarket wins, Mercado Libre, and so on. */
function OtherKindOption({ plan, days }: { plan: PlanResponse['items'][number]; days: PlanResponse['days'] }) {
  if (!plan.best) return null;
  const bestKind = STORES[plan.best.store].kind;
  const others = (['super', 'farmacia', 'online'] as const)
    .filter((kind) => kind !== bestKind)
    .map((kind) => plan.options.find((o) => STORES[o.store].kind === kind))
    .filter((o) => o !== undefined);
  return (
    <>
      {others.map((o) => (
        <Text key={o.store} style={styles.promoDetail}>
          {KIND_LABEL[STORES[o.store].kind]}: {storeName(o.store)} {dayLabel(o.day, days)} · {money(o.cost)}
          {o.promotion ? ` (${o.promotion.promotion.discountPct}% off)` : ''}
        </Text>
      ))}
    </>
  );
}

/** Fuel stations, neighborhood shops and pharmacies we can't price, with the promo that would apply. */
function OtherShopsList({ shops, days }: { shops: OtherShop[]; days: PlanResponse['days'] }) {
  return (
    <View style={{ marginTop: 6 }}>
      {shops.map((o) => (
        <View key={o.promotion.id} style={{ marginTop: 4 }}>
          <Text style={[styles.promoDetail, o.cheaper && o.owned ? styles.cheaperElsewhere : null, !o.owned && { opacity: 0.6 }]}>
            {o.kind === 'combustible' ? '⛽' : o.kind === 'farmacia' ? '💊' : '🏪'} {o.label}: {o.promotion.discountPct}%{' '}
            {dayLabel(o.day, days)}
            {o.saving > 0
              ? o.kind === 'combustible'
                ? ` · ahorrás ${money(o.saving)} sobre ${money(o.baseAmount)}`
                : ` · ~${money(o.estimatedCost)}${o.cheaper ? ' (más barato que las cadenas)' : ''}`
              : o.promotion.minPurchase
                ? ` · mínimo ${money(o.promotion.minPurchase)}`
                : ''}
          </Text>
          <Text style={styles.otherShopMeta}>
            {o.owned
              ? `${o.promotion.payment ?? promoHeadline(o.promotion)} · ${promoConditions(o.promotion)}`
              : `Si tuvieras ${o.promotion.requires.map(sourceName).join(' + ')} · ${promoConditions(o.promotion)}`}
            {o.promotion.notes ? ` · ${o.promotion.notes}` : ''}
            {o.kind !== 'combustible' && o.saving > 0 ? ' · precio estimado con el de las cadenas' : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PriceNote({ insight }: { insight: ReturnType<typeof priceInsight> }) {
  const parts: string[] = [];
  if (insight.changePct !== undefined) parts.push(insight.changePct > 0 ? `↑ subió ${insight.changePct}%` : `↓ bajó ${-insight.changePct}%`);
  if (insight.lowest) parts.push(`mín. visto ${money(insight.lowest.price)} el ${insight.lowest.date.slice(8)}/${insight.lowest.date.slice(5, 7)}`);
  if (parts.length === 0 && !insight.inflatedListPrice) return null;
  return (
    <Text style={styles.priceNote}>
      {parts.join(' · ')}
      {insight.inflatedListPrice ? <Text style={styles.verify}>{parts.length ? ' · ' : ''}⚠ "precio antes" inflado</Text> : null}
    </Text>
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
  scanButton: { padding: 8, borderRadius: 10, backgroundColor: '#eff6ff' },
  button: { backgroundColor: colors.brand, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { color: colors.faint, marginTop: 8, fontSize: 12 },
  cheaperElsewhere: { color: colors.good, fontSize: 12, fontWeight: '600', marginTop: 2 },
  otherShopMeta: { color: colors.faint, fontSize: 11, marginTop: 1 },
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
  line: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 8 },
  check: { marginRight: 8, marginTop: 1 },
  priceNote: { color: colors.muted, fontSize: 11, marginTop: 2 },
  done: { textDecorationLine: 'line-through', color: colors.faint },
  lineActions: { flexDirection: 'row', gap: 14, marginTop: 4 },
  lineAction: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  stopActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  boughtButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: '#eff6ff' },
  boughtText: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  summaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  branch: { color: colors.muted, fontSize: 13, marginTop: 6 },
  summaryAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  summaryActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
