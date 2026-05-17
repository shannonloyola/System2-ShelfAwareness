import { create } from 'zustand';

export type DashboardRole = 'Executive' | 'Operations' | 'Procurement';

export type DateRange = '7D' | '30D' | '90D' | 'Custom';

export interface DashboardFilters {
  bucket: string | null;
  category: string | null;
  supplier: string | null;
  zone: string | null;
  sku: string | null;
  status: string | null;
}

interface DashboardState {
  activeRole: DashboardRole;
  dateRange: DateRange;
  filters: DashboardFilters;
  expandedPanel: string | null;
  setActiveRole: (role: DashboardRole) => void;
  setDateRange: (range: DateRange) => void;
  setFilter: (key: keyof DashboardFilters, value: string | null) => void;
  clearFilters: () => void;
  setExpandedPanel: (panelId: string | null) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeRole: 'Executive',
  dateRange: '30D',
  filters: {
    bucket: null,
    category: null,
    supplier: null,
    zone: null,
    sku: null,
    status: null,
  },
  expandedPanel: null,
  setActiveRole: (role) => set({ activeRole: role }),
  setDateRange: (range) => set({ dateRange: range }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  clearFilters: () =>
    set({
      filters: {
        bucket: null,
        category: null,
        supplier: null,
        zone: null,
        sku: null,
        status: null,
      },
    }),
  setExpandedPanel: (panelId) => set({ expandedPanel: panelId })
}));
