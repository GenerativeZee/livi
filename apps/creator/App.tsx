import { StatusBar } from 'expo-status-bar';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { computeSplit, DEFAULT_TERMS, DEMO_PRODUCTS, formatINR } from '@stealth/shared';

// Placeholder home for the creator app: the stream lineup with what the creator earns per sale.
// Going live natively (IVS broadcast SDK in a dev build) replaces the web /spike/live page after Phase 0.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Tonight&apos;s lineup</Text>
      <FlatList
        data={DEMO_PRODUCTS}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const split = computeSplit(item.price, { ...DEFAULT_TERMS, gstBps: item.gstBps });
          return (
            <View style={styles.card}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.meta}>
                {formatINR(item.price)} · you earn {formatINR(split.creatorCommission)} per sale
              </Text>
            </View>
          );
        }}
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    paddingTop: 64,
  },
  heading: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 16,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  card: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 12,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: '#a1a1aa',
    fontSize: 13,
    marginTop: 4,
  },
});
