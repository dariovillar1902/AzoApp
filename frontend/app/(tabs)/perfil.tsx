import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKUP_KEYS, decodeBackup, encodeBackup } from '../../lib/client/backup';
import { Card, colors, Header, SectionTitle } from '../../components/ui';
import { SOURCES } from '../../lib/benefits/sources';
import { isEligible, upcomingDays } from '../../lib/benefits/eligibility';
import type { Promotion } from '../../lib/benefits/types';
import { apiOrigin } from '../../lib/client/api';
import { merchantName, money, promoHeadline } from '../../lib/client/format';
import { useSettings } from '../../lib/client/profile';
import { applyReceipts, parseReceipts, type AppliedReceipt } from '../../lib/client/receipts';
import { STORES, STORE_IDS } from '../../lib/stores/registry';

const AUDIENCES = [
  { id: 'plan-sueldo', label: 'Cobro el sueldo en uno de mis bancos' },
  { id: 'comunidad-coto', label: 'Soy socio de Comunidad Coto (gratis)' },
  { id: 'jubilados', label: 'Soy jubilado/a o pensionado/a' },
];

function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export default function ProfileScreen() {
  const { settings, update } = useSettings();
  const mine = SOURCES.slice(0, 9);
  const others = SOURCES.slice(9);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Header eyebrow="Configuración" title="Mis medios" subtitle="Solo se usan promos de lo que tenés activado" />
        <View style={styles.body}>
          <SectionTitle>Bancos, tarjetas y billeteras</SectionTitle>
          <Card>
            {mine.map((s) => (
              <ToggleRow key={s.id} label={s.name} value={settings.sources.includes(s.id)} onChange={(on) => update({ sources: toggle(settings.sources, s.id, on) })} />
            ))}
          </Card>

          <SectionTitle>Otros</SectionTitle>
          <Card>
            {others.map((s) => (
              <ToggleRow key={s.id} label={s.name} value={settings.sources.includes(s.id)} onChange={(on) => update({ sources: toggle(settings.sources, s.id, on) })} />
            ))}
          </Card>

          <SectionTitle>Registrar reintegros</SectionTitle>
          <ReceiptImport />

          <SectionTitle>Respaldo / otro dispositivo</SectionTitle>
          <BackupCard />

          <SectionTitle>Segmentos</SectionTitle>
          <Card>
            {AUDIENCES.map((a) => (
              <ToggleRow key={a.id} label={a.label} value={settings.audiences.includes(a.id)} onChange={(on) => update({ audiences: toggle(settings.audiences, a.id, on) })} />
            ))}
          </Card>

          <SectionTitle>Cadenas donde comparar precios</SectionTitle>
          <Card>
            {STORE_IDS.map((id) => (
              <ToggleRow
                key={id}
                label={`${STORES[id].name} (${{ super: 'súper', farmacia: 'farmacia', online: 'online, con envío' }[STORES[id].kind]})`}
                value={settings.stores.includes(id)}
                onChange={(on) => update({ stores: toggle(settings.stores, id, on) })}
              />
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Paste refund notices from Mercado Pago, MODO or the bank: each one is
 * counted against the matching promo's tope so the planner knows what's left.
 */
function ReceiptImport() {
  const { settings, update } = useSettings();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<AppliedReceipt[] | null>(null);

  const read = async () => {
    setBusy(true);
    try {
      const json = await fetch(`${apiOrigin()}/api/promos`).then((r) => r.json());
      const promotions = (json.promotions as Promotion[]).filter((p) => isEligible(p, settings));
      const receipts = parseReceipts(text, upcomingDays()[0].date);
      const result = applyReceipts(settings.capUsage, receipts, promotions);
      update({ capUsage: result.usage });
      setApplied(result.applied);
      setText('');
    } catch {
      setApplied([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text style={styles.help}>
        Pegá el aviso de reintegro de Mercado Pago, MODO o tu banco (varios separados por una línea en blanco). Se descuenta del tope de esa promo.
      </Text>
      <TextInput
        style={styles.receiptInput}
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Te devolvimos $2.500 por tu compra en Farmacity el 21/10/2026"
        placeholderTextColor={colors.faint}
        textAlignVertical="top"
      />
      <Pressable onPress={read} disabled={busy || !text.trim()} style={[styles.button, !text.trim() && { opacity: 0.4 }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Leer comprobantes</Text>}
      </Pressable>
      {applied?.length === 0 ? <Text style={styles.help}>No encontré montos de reintegro en el texto.</Text> : null}
      {applied?.map(({ receipt, promotion }, i) => (
        <Text key={i} style={styles.help}>
          {money(receipt.amount)} {receipt.merchant ? `en ${merchantName(receipt.merchant)} ` : ''}({receipt.date.split('-').reverse().join('/')}):{' '}
          {promotion ? `sumado al tope de ${promoHeadline(promotion)}` : 'no coincide con ninguna promo con tope'}
        </Text>
      ))}
    </Card>
  );
}

/**
 * Moves everything (medios, topes usados, correcciones, lista, historial de
 * precios) to another device or keeps a copy: one line of text you can send
 * yourself by WhatsApp, mail or AirDrop.
 */
function BackupCard() {
  const { reload } = useSettings();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const exportData = async () => {
    try {
      const pairs = await AsyncStorage.multiGet(BACKUP_KEYS);
      const code = encodeBackup(Object.fromEntries(pairs));
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(code);
        setMessage('Respaldo copiado al portapapeles.');
      } else {
        await Share.share({ message: code });
      }
    } catch {
      setMessage('No se pudo exportar.');
    }
  };

  const importData = async () => {
    try {
      const values = decodeBackup(text);
      await AsyncStorage.multiSet(Object.entries(values));
      reload();
      setText('');
      setMessage('Respaldo restaurado. Cerrá y volvé a abrir la app para ver la lista y el historial.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Respaldo inválido.');
    }
  };

  return (
    <Card>
      <Text style={styles.help}>Exportá tus datos para pasarlos a otro celular o a la web, o pegá acá un respaldo para restaurarlo.</Text>
      <Pressable onPress={exportData} style={styles.button}>
        <Text style={styles.buttonText}>Exportar respaldo</Text>
      </Pressable>
      <TextInput style={styles.receiptInput} multiline value={text} onChangeText={setText} placeholder="AZOAPP1:…" placeholderTextColor={colors.faint} />
      <Pressable onPress={importData} disabled={!text.trim()} style={[styles.button, !text.trim() && { opacity: 0.4 }]}>
        <Text style={styles.buttonText}>Restaurar</Text>
      </Pressable>
      {message ? <Text style={styles.help}>{message}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: colors.text, fontSize: 15, fontWeight: '500', flex: 1 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  receiptInput: { minHeight: 90, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, marginTop: 10, color: colors.text, fontSize: 14 },
  button: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
