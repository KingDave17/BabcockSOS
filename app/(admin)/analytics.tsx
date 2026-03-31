import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useTheme } from '../../hooks/ThemeContext';

const ADMIN_ACCENT = '#7C3AED';

const CATEGORY_COLORS: Record<string, string> = {
  'Medical': '#DC2626',
  'Fire': '#F59E0B',
  'Security': '#3B82F6',
  'Accident': '#8B5CF6',
  'Critical SOS': '#991B1B',
  'Other': '#6B7280',
};

const ROLE_COLORS: Record<string, string> = {
  student: '#3B82F6',
  medical: '#DC2626',
  security: '#10B981',
  admin: '#7C3AED',
};

interface BarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

function HorizontalBar({ label, value, maxValue, color }: BarProps) {
  const { colors } = useTheme();
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <View style={bar.row}>
      <Text style={[bar.label, { color: colors.textSub }]} numberOfLines={1}>{label}</Text>
      <View style={[bar.track, { backgroundColor: colors.border }]}>
        <View style={[bar.fill, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[bar.count, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  label: { width: 90, fontSize: 12, fontWeight: '600' },
  track: { flex: 1, height: 10, borderRadius: 5, marginHorizontal: 10, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  count: { width: 30, fontSize: 13, fontWeight: '700', textAlign: 'right' },
});

export default function AdminAnalyticsScreen() {
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsub1 = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    const unsub2 = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  // ---- Computed analytics ----
  const totalAlerts = (alerts || []).length;
  const activeAlerts = (alerts || []).filter(a => (a?.status || 'Active') === 'Active').length;
  const resolvedAlerts = (alerts || []).filter(a => (a?.status || 'Active') !== 'Active').length;
  const resolutionRate = totalAlerts > 0 ? Math.round((resolvedAlerts / totalAlerts) * 100) : 0;

  // Category breakdown
  const categories = ['Medical', 'Fire', 'Security', 'Accident', 'Critical SOS'];
  const categoryCounts = categories.map(cat => ({
    name: cat,
    count: (alerts || []).filter(a => a?.type?.includes(cat)).length,
    color: CATEGORY_COLORS[cat],
  }));
  const otherCount = (alerts || []).filter(a => !categories.some(c => a?.type?.includes(c))).length;
  if (otherCount > 0) categoryCounts.push({ name: 'Other', count: otherCount, color: CATEGORY_COLORS['Other'] });
  const maxCatCount = Math.max(...categoryCounts.map(c => c.count), 1);

  // Role distribution
  const roles = ['student', 'medical', 'security', 'admin'];
  const roleCounts = roles.map(role => ({
    name: role,
    count: (users || []).filter(u => u?.role === role).length,
    color: ROLE_COLORS[role],
  }));
  const maxRoleCount = Math.max(...roleCounts.map(r => r?.count || 0), 1);

  // Alerts last 7 days (by day)
  const now = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return d;
  });
  const dayAlerts = last7Days.map(day => {
    const count = alerts.filter(a => {
      if (!a.timestamp) return false;
      try {
        const alertDate = a.timestamp.toDate();
        return alertDate.toDateString() === day.toDateString();
      } catch { return false; }
    }).length;
    return {
      day: day.toLocaleDateString('en-US', { weekday: 'short' }),
      count,
    };
  });
  const maxDayCount = Math.max(...dayAlerts.map(d => d.count), 1);

  // Sender role breakdown for alerts
  const senderRoleCounts = roles.map(role => ({
    name: role,
    count: (alerts || []).filter(a => a?.senderRole === role).length,
    color: ROLE_COLORS[role],
  }));

  const SectionCard = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sectionCardHeader}>
        <MaterialCommunityIcons name={icon as any} size={18} color={ADMIN_ACCENT} />
        <Text style={[styles.sectionCardTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ADMIN_ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: isDarkMode ? '#0F0F1A' : '#7C3AED' }]}>
        <Text style={styles.headerTitle}>ANALYTICS</Text>
        <Text style={styles.headerSub}>Live data · {totalAlerts} total alerts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          {[
            { label: 'Resolution Rate', value: `${resolutionRate}%`, color: resolutionRate > 70 ? '#10B981' : '#F59E0B', icon: 'chart-pie' },
            { label: 'Active Incidents', value: activeAlerts, color: activeAlerts > 0 ? '#DC2626' : '#10B981', icon: 'alert-circle' },
            { label: 'Total Users', value: users.length, color: ADMIN_ACCENT, icon: 'account-group' },
          ].map((kpi, i) => (
            <View key={i} style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name={kpi.icon as any} size={24} color={kpi.color} />
              <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
              <Text style={[styles.kpiLabel, { color: colors.textSub }]}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* Weekly Activity Sparkline */}
        <SectionCard title="Alerts This Week" icon="calendar-week">
          <View style={styles.sparklineContainer}>
            {dayAlerts.map((day, i) => {
              const pct = day.count > 0 ? (day.count / maxDayCount) : 0.04;
              return (
                <View key={i} style={styles.sparklineCol}>
                  <Text style={[styles.sparklineCount, { color: colors.text, opacity: day.count > 0 ? 1 : 0 }]}>
                    {day.count}
                  </Text>
                  <View style={styles.sparklineBarTrack}>
                    <View
                      style={[
                        styles.sparklineBarFill,
                        {
                          height: `${Math.max(pct * 100, 4)}%`,
                          backgroundColor: day.count > 0 ? ADMIN_ACCENT : colors.border,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.sparklineDay, { color: colors.textSub }]}>{day.day}</Text>
                </View>
              );
            })}
          </View>
        </SectionCard>

        {/* Alert by category */}
        <SectionCard title="Alerts by Category" icon="chart-bar">
          {categoryCounts.map(cat => (
            <HorizontalBar key={cat.name} label={cat.name} value={cat.count} maxValue={maxCatCount} color={cat.color} />
          ))}
          {categoryCounts.every(c => c.count === 0) && (
            <Text style={[styles.noDataText, { color: colors.textSub }]}>No alert data yet</Text>
          )}
        </SectionCard>

        {/* User role distribution */}
        <SectionCard title="User Distribution by Role" icon="account-group">
          {roleCounts.map(rc => (
            <HorizontalBar key={rc.name} label={rc.name} value={rc.count} maxValue={maxRoleCount} color={rc.color} />
          ))}
        </SectionCard>

        {/* Who Sends Alerts */}
        <SectionCard title="Alert Reporters by Role" icon="send">
          {senderRoleCounts.map(sr => (
            <HorizontalBar key={sr.name} label={sr.name} value={sr.count} maxValue={Math.max(...senderRoleCounts.map(x => x.count), 1)} color={sr.color} />
          ))}
          {senderRoleCounts.every(s => s.count === 0) && (
            <Text style={[styles.noDataText, { color: colors.textSub }]}>No sender data yet</Text>
          )}
        </SectionCard>

        {/* Resolution Status Donut-style */}
        <SectionCard title="Alert Status Overview" icon="check-circle">
          <View style={styles.statusOverview}>
            {[
              { label: 'Active', count: activeAlerts, color: '#DC2626' },
              { label: 'Resolved', count: resolvedAlerts, color: '#10B981' },
              { label: 'Total', count: totalAlerts, color: ADMIN_ACCENT },
            ].map((item, i) => (
              <View key={i} style={[styles.statusBlock, { backgroundColor: item.color + '12', borderColor: item.color + '30' }]}>
                <Text style={[styles.statusBlockValue, { color: item.color }]}>{item.count}</Text>
                <Text style={[styles.statusBlockLabel, { color: colors.textSub }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          {/* Resolution bar */}
          <View style={styles.resBarLabel}>
            <Text style={[styles.resBarLabelText, { color: colors.textSub }]}>Resolution Rate</Text>
            <Text style={[styles.resBarPct, { color: resolutionRate > 70 ? '#10B981' : '#F59E0B' }]}>{resolutionRate}%</Text>
          </View>
          <View style={[styles.resBarTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.resBarFill, {
              width: `${resolutionRate}%`,
              backgroundColor: resolutionRate > 70 ? '#10B981' : '#F59E0B',
            }]} />
          </View>
        </SectionCard>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: '500' },
  scrollContent: { padding: 16, paddingBottom: 100 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  sectionCardTitle: { fontSize: 15, fontWeight: '700' },

  sparklineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  sparklineCol: { flex: 1, alignItems: 'center', height: '100%' },
  sparklineCount: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  sparklineBarTrack: {
    flex: 1,
    width: 18,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  sparklineBarFill: { width: '100%', borderRadius: 6, minHeight: 4 },
  sparklineDay: { fontSize: 10, fontWeight: '600', marginTop: 6 },

  noDataText: { fontSize: 13, fontWeight: '500', textAlign: 'center', paddingVertical: 16 },

  statusOverview: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statusBlock: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusBlockValue: { fontSize: 24, fontWeight: '900' },
  statusBlockLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  resBarLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resBarLabelText: { fontSize: 13, fontWeight: '600' },
  resBarPct: { fontSize: 16, fontWeight: '800' },
  resBarTrack: { height: 12, borderRadius: 6, overflow: 'hidden' },
  resBarFill: { height: '100%', borderRadius: 6 },
});
