import { View, Text, Image, ScrollView, ActivityIndicator, Linking, Pressable, StatusBar, StyleSheet, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { API_URL } from '../../constants/Config';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Discount {
  id: number;
  title: string;
  description: string;
  bankName: string;
  category: string;
  amount: number | null;
  currency: string;
  validDays: string[];
  url: string;
  imageUrl: string | null;
  expirationDate: string | null;
}

const { width } = Dimensions.get('window');

export default function DiscountDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchDiscount();
    }
  }, [id]);

  const fetchDiscount = async () => {
    try {
      const response = await fetch(`${API_URL}/api/discounts/${id}`);
      if (response.ok) {
        const data = await response.json();
        setDiscount(data);
      }
    } catch (error) {
      console.error("Error fetching discount details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!discount) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Discount not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Header Image Area */}
            <View style={styles.imageContainer}>
                {discount.imageUrl ? (
                    <Image source={{ uri: discount.imageUrl }} style={styles.heroImage} resizeMode="cover" />
                ) : (
                    <View style={[styles.heroImage, styles.imagePlaceholder]}>
                         <Text style={styles.placeholderText}>No Image Available</Text>
                    </View>
                )}
                
                {/* Gradient Overlay */}
                <LinearGradient
                    colors={['transparent', 'rgba(15, 23, 42, 0.9)']}
                    style={styles.gradient}
                />

                {/* Back Button */}
                <Pressable 
                    onPress={() => router.back()} 
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                >
                    <Ionicons name="arrow-back" size={24} color="white" />
                </Pressable>
            </View>

            {/* Content Container (Floating effect) */}
            <View style={styles.contentCard}>
                
                {/* Meta Badge */}
                <View style={styles.metaContainer}>
                    <View style={styles.bankBadge}>
                        <Text style={styles.bankBadgeText}>{discount.bankName}</Text>
                    </View>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{discount.category}</Text>
                    </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>{discount.title}</Text>

                {/* Discount Highlight */}
                {discount.amount != null ? (
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountValue}>
                            {discount.currency === '%' ? `${discount.amount}%` : `$${discount.amount}`}
                        </Text>
                        <Text style={styles.amountLabel}>OFF</Text>
                    </View>
                ) : discount.category === 'Promoción' ? (
                    <View style={styles.amountContainer}>
                        <Text style={[styles.amountValue, { color: '#f59e0b' }]}>PROMO</Text>
                    </View>
                ) : null}

                {/* Description */}
                <Text style={styles.sectionHeader}>Detalle</Text>
                <Text style={styles.description}>
                    {discount.description || "Aprovechá este beneficio exclusivo presentando tu tarjeta o credencial al momento de pagar. Consultá los términos y condiciones en el sitio web."}
                </Text>

                {/* Validity Information */}
                <View style={styles.validityContainer}>
                     {(discount.validDays && discount.validDays.length > 0) ? (
                        <View>
                            <Text style={styles.validityTitle}>Días Válidos</Text>
                            <View style={styles.daysGrid}>
                                {discount.validDays.map(day => (
                                    <View key={day} style={styles.dayBadge}>
                                        <Text style={styles.dayText}>{day}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                     ) : (
                        <Text style={styles.validGenericText}>Válido todos los días (sujeto a verificación)</Text>
                     )}
                </View>

            </View>
        </ScrollView>

        {/* Floating Action Button Area */}
        <View style={styles.fabContainer}>
             <Pressable 
                onPress={() => Linking.openURL(discount.url)}
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            >
                <Text style={styles.fabText}>Ir al sitio web</Text>
                <Ionicons name="open-outline" size={22} color="white" style={{ marginLeft: 8 }} />
            </Pressable>
        </View>
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
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    height: 320,
    width: '100%',
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#475569',
    fontWeight: 'bold',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backButtonPressed: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  contentCard: {
    marginTop: -40,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    minHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  metaContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  bankBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginRight: 8,
  },
  bankBadgeText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: '#eff6ff', // Blue-50
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  categoryBadgeText: {
    color: '#2563eb', // Blue-600
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 34,
    marginBottom: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  amountValue: {
    fontSize: 40,
    fontWeight: '900',
    color: '#10b981', // Emerald-500
  },
  amountLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#059669', // Emerald-600
    marginLeft: 4,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 32,
  },
  validityContainer: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 32,
  },
  validityTitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  validGenericText: {
    color: '#94a3b8',
    fontStyle: 'italic',
    fontSize: 14,
  },
  errorText: {
    color: '#64748b',
    fontSize: 16,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  fab: {
    backgroundColor: '#2563eb', // Blue-600
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  fabPressed: {
    backgroundColor: '#1d4ed8', // Blue-700
    transform: [{ scale: 0.99 }],
  },
  fabText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
