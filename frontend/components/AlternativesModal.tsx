import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiOrigin } from '../lib/client/api';
import { money, unitPrice } from '../lib/client/format';
import { storeName } from '../lib/stores/registry';
import type { ProductOffer, StoreId } from '../lib/types';
import { colors } from './ui';

export interface AlternativesTarget {
  store: StoreId;
  query: string;
  excluded: string[];
}

/** Lists what a store actually sells for an item so the user can pick the right product by hand. */
export function AlternativesModal({
  target,
  onPick,
  onClose,
}: {
  target: AlternativesTarget | null;
  onPick: (offer: ProductOffer) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [offers, setOffers] = useState<ProductOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string) => {
    if (!target || !query.trim()) return;
    setOffers(null);
    setError(null);
    try {
      const params = new URLSearchParams({ store: target.store, q: query.trim(), exclude: target.excluded.join(',') });
      const response = await fetch(`${apiOrigin()}/api/alternatives?${params}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setOffers(json.offers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar');
      setOffers([]);
    }
  };

  useEffect(() => {
    if (target) {
      setText(target.query);
      search(target.query);
    }
  }, [target]);

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Elegir en {target ? storeName(target.store) : ''}</Text>
          <View style={styles.searchRow}>
            <TextInput style={styles.input} value={text} onChangeText={setText} onSubmitEditing={() => search(text)} returnKeyType="search" />
            <Pressable style={styles.searchButton} onPress={() => search(text)}>
              <Text style={styles.searchButtonText}>Buscar</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            {offers === null ? <ActivityIndicator style={{ margin: 24 }} color={colors.brand} /> : null}
            {error ? <Text style={styles.empty}>{error}</Text> : null}
            {offers && offers.length === 0 && !error ? <Text style={styles.empty}>No hay resultados.</Text> : null}
            {offers?.map((offer) => (
              <Pressable key={offer.id} style={styles.option} onPress={() => onPick(offer)}>
                <Text style={styles.optionName}>{offer.name}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.optionPrice}>{money(offer.price)}</Text>
                  {unitPrice(offer) ? <Text style={styles.optionUnit}>{unitPrice(offer)}</Text> : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: colors.text },
  searchButton: { backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  optionName: { flex: 1, color: colors.text },
  optionPrice: { fontWeight: '700', color: colors.text },
  optionUnit: { fontSize: 11, color: colors.muted },
  empty: { color: colors.faint, textAlign: 'center', margin: 24 },
  close: { alignItems: 'center', marginTop: 12 },
  closeText: { color: colors.muted, fontWeight: '700' },
});
