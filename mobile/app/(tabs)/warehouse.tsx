import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { palette, spacing, shadow } from '@/constants/design';

export default function WarehouseScreen() {
  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Warehouse Operations</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Card 1: Receive Shipment */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/scan-shipment')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="archive-outline" size={28} color="#00A3AD" />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Receive Shipment</Text>
            <Text style={styles.cardDesc}>
              Scan a shipment QR to receive goods
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Card 2: Stock Lookup */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(tabs)/stock-lookup')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="search-outline" size={28} color="#00A3AD" />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Stock Lookup</Text>
            <Text style={styles.cardDesc}>
              Scan a product or bin QR to check stock
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2B47',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 20,
    ...shadow.card,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#E6F7F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B47',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
});
