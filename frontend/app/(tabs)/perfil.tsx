import { ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { Card, colors, Header, SectionTitle } from '../../components/ui';
import { SOURCES } from '../../lib/benefits/sources';
import { useSettings } from '../../lib/client/profile';
import { STORES, STORE_IDS } from '../../lib/stores/registry';

const AUDIENCES = [{ id: 'jubilados', label: 'Soy jubilado/a o pensionado/a' }];

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
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />
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
                label={`${STORES[id].name} (${STORES[id].kind === 'super' ? 'súper' : 'farmacia'})`}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: colors.text, fontSize: 15, fontWeight: '500', flex: 1 },
});
