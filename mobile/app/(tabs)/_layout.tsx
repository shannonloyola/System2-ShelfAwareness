import { Tabs, useSegments, router } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

function CustomTabBar() {
  const { canAccessTab } = useAuth();
  const segments = useSegments();

  const allTabs = [
    {
      name: 'dashboard',
      route: '/(tabs)',
      label: 'Dashboard',
      icon: 'grid-outline' as const,
      iconFocused: 'grid' as const,
    },
    {
      name: 'stock-lookup',
      route: '/(tabs)/stock-lookup',
      label: 'Stock Lookup',
      icon: 'search-outline' as const,
      iconFocused: 'search' as const,
    },
    {
      name: 'warehouse',
      route: '/(tabs)/warehouse',
      label: 'Warehouse',
      icon: 'cube-outline' as const,
      iconFocused: 'cube' as const,
    },
  ];

  const visibleTabs = allTabs.filter(tab => canAccessTab(tab.name));

  return (
    <View style={styles.tabBar}>
      {visibleTabs.map(tab => {
        const segment = segments[1] as string | undefined;
        let focused = false;
        if (tab.name === 'dashboard') {
          focused = segment === undefined || segment === 'index';
        } else if (tab.name === 'stock-lookup') {
          focused = segment === 'stock-lookup';
        } else if (tab.name === 'warehouse') {
          focused = segment === 'warehouse';
        }

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            {focused && <View style={styles.activeBar} />}
            <Ionicons
              name={focused ? tab.iconFocused : tab.icon}
              size={24}
              color={focused ? '#1A2B47' : '#9CA3AF'}
            />
            <Text style={[
              styles.tabLabel,
              { color: focused ? '#1A2B47' : '#9CA3AF' }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    top: -8,
    width: 28,
    height: 3,
    backgroundColor: '#1A2B47',
    borderRadius: 1.5,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="stock-lookup" />
      <Tabs.Screen name="warehouse" />
    </Tabs>
  );
}
