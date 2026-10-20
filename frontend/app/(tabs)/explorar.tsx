import { View, Text, FlatList, ActivityIndicator, Image, Pressable, StatusBar, StyleSheet, Platform, Dimensions, TextInput } from 'react-native';
import { useEffect, useState, useMemo } from 'react';
import { apiOrigin } from '../../lib/client/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/client/profile';

interface Discount {
  id: string;
  title: string;
  bankName: string;
  category: string;
  amount: number | null;
  currency: string;
  imageUrl: string | null;
  stores: string[] | null;
  requires: string[];
}

const MINE = "Mis medios";
const ALL = "Todos";

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const numColumns = isWeb ? (width > 800 ? 3 : 2) : 1;

export default function HomeScreen() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState(MINE);
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const banks = useMemo(() => [MINE, ALL, ...new Set(discounts.map((d) => d.bankName))], [discounts]);

  const fetchDiscounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiOrigin()}/api/discounts`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setDiscounts(data.discounts);
      setFailed(data.failed ?? []);
      setLastUpdated(new Date(data.fetchedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
    } catch {
      setError('No pude cargar los beneficios. Revisá la conexión y tocá ↺.');
    } finally {
      setLoading(false);
    }
  };

  const triggerScrape = async (): Promise<void> => {
    setScraping(true);
    await fetchDiscounts();
    setScraping(false);
  };

  const filteredDiscounts = useMemo(() => {
    const mine = selectedBank === MINE
      ? discounts.filter(d => d.requires.every(r => settings.sources.includes(r)))
      : selectedBank === ALL
      ? discounts
      : discounts.filter(d => d.bankName === selectedBank);
    if (!searchQuery) return mine;
    const lower = searchQuery.toLowerCase();
    return mine.filter(d => 
        d.title.toLowerCase().includes(lower) || 
        d.category.toLowerCase().includes(lower) ||
        d.bankName.toLowerCase().includes(lower)
    );
  }, [discounts, searchQuery, selectedBank, settings.sources]);

  const renderItem = ({ item }: { item: Discount }) => (
    <Pressable 
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed
      ]}
      onPress={() => router.push(`/discount/${encodeURIComponent(item.id)}`)}
    >
      <View style={styles.cardContent}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
            <View style={[styles.cardImage, styles.cardPlaceholder]}>
                <Text style={styles.placeholderText}>No Image</Text>
            </View>
        )}
        
        <View style={styles.cardDetails}>
            <View>
                <View style={styles.cardHeader}>
                    <View style={styles.bankBadge}>
                        <Text style={styles.bankBadgeText}>{item.bankName}</Text>
                    </View>
                    {item.amount != null ? (
                        <View style={styles.discountBadge}>
                            <Text style={styles.discountText}>
                                {item.currency === '%' ? `${item.amount}% OFF` : `$${item.amount}`}
                            </Text>
                        </View>
                    ) : item.category === 'Promoción' ? (
                        <View style={[styles.discountBadge, styles.promoBadge]}>
                            <Text style={[styles.discountText, styles.promoText]}>PROMO</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            </View>
            
            <View style={styles.cardFooter}>
                 <Text style={styles.categoryText}>{item.category}</Text>
                 {item.stores && item.stores.length > 0 && (
                     <Text style={styles.storesText} numberOfLines={1}>
                         {item.stores.slice(0, 3).join(' · ')}
                         {item.stores.length > 3 ? ` +${item.stores.length - 3} más` : ''}
                     </Text>
                 )}
            </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header Area */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcomeText}>Beneficios de bancos y clubes</Text>
            <Text style={styles.appTitle}>Explorar</Text>
          </View>
          <Pressable
            onPress={triggerScrape}
            disabled={scraping}
            style={({ pressed }) => [
              styles.refreshButton,
              (pressed || scraping) && styles.refreshButtonActive,
            ]}
          >
            {scraping
              ? <ActivityIndicator size="small" color="#ffffff" />
              : <Ionicons name="refresh" size={20} color="#ffffff" />
            }
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {scraping
            ? 'Actualizando descuentos...'
            : lastUpdated
            ? `Actualizado: ${lastUpdated}${failed.length > 0 ? ` · sin respuesta: ${failed.join(', ')}` : ''}`
            : 'Tocá ↺ para cargar descuentos'}
        </Text>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
            <TextInput 
                placeholder="Buscar por marca o rubro..." 
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <FlatList
          data={banks}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterListContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedBank(item)}
              style={[
                styles.filterPill,
                selectedBank === item && styles.filterPillSelected
              ]}
            >
              <Text style={[
                styles.filterText,
                selectedBank === item && styles.filterTextSelected
              ]}>{item}</Text>
            </Pressable>
          )}
          keyExtractor={item => item}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Buscando descuentos...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDiscounts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          numColumns={numColumns}
          key={numColumns} // Force re-render on layout change
          ListEmptyComponent={
            <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>{error ?? 'No se encontraron descuentos'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  header: {
    backgroundColor: '#0f172a',
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  refreshButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    paddingVertical: 10,
    fontSize: 14,
  },
  welcomeText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 4,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterListContent: {
    paddingHorizontal: 16,
  },
  filterPill: {
    marginRight: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  filterPillSelected: {
    backgroundColor: '#3b82f6', // Blue-500
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  filterTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 100,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    flex: 1,
    marginHorizontal: isWeb ? 8 : 0, // Gutter for grid
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  cardContent: {
    flexDirection: 'row',
  },
  cardImage: {
    width: 110,
    height: 110,
    backgroundColor: '#cbd5e1',
  },
  cardPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 10,
  },
  cardDetails: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bankBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bankBadgeText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  discountBadge: {
    backgroundColor: '#ecfdf5', // Emerald-50
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  discountText: {
    color: '#047857', // Emerald-700
    fontSize: 11,
    fontWeight: '800',
  },
  promoBadge: {
    backgroundColor: '#fef3c7',
  },
  promoText: {
    color: '#92400e',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 22,
    marginRight: 4,
  },
  cardFooter: {
    marginTop: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  storesText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontWeight: '500',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },
});
