import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/ThemeContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SafetyScreen() {
  const { colors, isDarkMode } = useTheme();
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch((err) => console.error('Error opening dialer:', err));
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const ContactRow = ({ title, sub, number, iconColor, bg }: any) => (
    <View style={styles.contactRow}>
      <View>
        <Text style={[styles.contactTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.contactSub, { color: colors.textSub }]}>{sub}</Text>
      </View>
      <TouchableOpacity 
        style={[
          styles.callBtn, 
          { backgroundColor: isDarkMode ? bg + '22' : bg, borderWidth: isDarkMode ? 1 : 0, borderColor: iconColor + '44' }
        ]}
        onPress={() => handleCall(number)}
        activeOpacity={0.7}
      >
        <Ionicons name={title.includes('National') ? 'warning' : 'call'} size={14} color={iconColor} />
        <Text style={[styles.callText, { color: iconColor }]}>{number}</Text>
      </TouchableOpacity>
    </View>
  );

  const GuidelineRow = ({ id, icon, title, color, instructions }: any) => {
    const isExpanded = expandedId === id;

    return (
      <View>
        <TouchableOpacity 
          style={styles.guideRow} 
          onPress={() => toggleExpand(id)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name={icon} size={22} color={color} style={{ marginRight: 15 }} />
            <Text style={[styles.guideTitle, { color: colors.text }]}>{title}</Text>
          </View>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={colors.textSub} 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={[styles.guideContent, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
            {instructions.map((step: string, index: number) => (
              <View key={index} style={styles.instructionStep}>
                <View style={[styles.stepDot, { backgroundColor: color }]} />
                <Text style={[styles.instructionText, { color: colors.text }]}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.headerBg }]}>
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Safety Information</Text>
        <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#BFDBFE' }]}>Prevention & preparedness guide</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
        
        {/* Contacts Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#1E3A8A44' : '#EFF6FF' }]}>
              <Ionicons name="call" size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Emergency Numbers</Text>
          </View>
          
          <ContactRow title="Campus Security" sub="24/7 Hotline" number="0800-BABCOCK" iconColor="#3B82F6" bg="#EFF6FF" />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <ContactRow title="Medical Emergency" sub="Babcock Teaching Hospital" number="0800-MEDICAL" iconColor="#3B82F6" bg="#EFF6FF" />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <ContactRow title="Fire Department" sub="Rapid Response Unit" number="0800-FIRE" iconColor="#3B82F6" bg="#EFF6FF" />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <ContactRow title="National Emergency" sub="Police / Fire / EMS" number="112" iconColor="#EF4444" bg="#FEF2F2" />
        </View>

        {/* Guidelines Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#065F4644' : '#D1FAE5' }]}>
              <Ionicons name="book" size={20} color="#10B981" />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Safety Guidelines</Text>
          </View>

          <GuidelineRow 
            id="medical" 
            icon="heart-pulse" 
            title="Medical Emergency" 
            color="#EF4444" 
            instructions={[
              "Ensure the scene is safe for you to enter.",
              "Do not move the victim unless they are in immediate danger.",
              "Call the Medical Emergency hotline immediately.",
              "Provide basic first aid or CPR if you are trained.",
              "Stay with the victim until help arrives."
            ]}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <GuidelineRow 
            id="fire" 
            icon="fire" 
            title="Fire Emergency" 
            color="#F59E0B" 
            instructions={[
              "Trigger the nearest fire alarm pull station.",
              "Evacuate the building immediately using the stairs.",
              "Do NOT use the elevators.",
              "If there is smoke, stay low to the ground.",
              "Once outside, proceed to the designated assembly point."
            ]}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <GuidelineRow 
            id="security" 
            icon="shield-half-full" 
            title="Security Threat" 
            color="#3B82F6" 
            instructions={[
              "Move to a safe, secure area immediately.",
              "Lock and barricade doors if you cannot evacuate safely.",
              "Silence your phone and remain quiet.",
              "Use the SOS slider on the home screen to alert security.",
              "Do not leave your secure area until given the all-clear by authorities."
            ]}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <GuidelineRow 
            id="firstaid" 
            icon="alert" 
            title="Basic First Aid" 
            color="#10B981" 
            instructions={[
              "For burns: Run cool (not cold) water over the burn for 10 minutes.",
              "For bleeding: Apply firm, direct pressure with a clean cloth.",
              "For choking: Perform the Heimlich maneuver if trained.",
              "For fainting: Lay the person flat on their back and elevate their legs.",
              "Always seek professional medical evaluation afterward."
            ]}
          />
        </View>

        {/* REMEMBER INFO BOX */}
        <View style={[styles.infoBox, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF', borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE' }]}>
          <Ionicons name="information-circle" size={22} color="#3B82F6" style={styles.infoBoxIcon} />
          <Text style={[styles.infoBoxText, { color: isDarkMode ? '#BFDBFE' : '#1E40AF' }]}>
            <Text style={{ fontWeight: 'bold' }}>Remember: </Text>
            In any emergency, your safety comes first. Always prioritize your well-being and that of others around you.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 30 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  scrollContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 100, minHeight: '100%' },
  card: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  contactTitle: { fontSize: 15, fontWeight: '600' },
  contactSub: { fontSize: 12, marginTop: 2 },
  callBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  callText: { fontWeight: 'bold', fontSize: 13, marginLeft: 6 },
  guideRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  guideTitle: { fontSize: 15, fontWeight: '600' },
  guideContent: { padding: 15, borderRadius: 12, marginTop: 5, marginBottom: 10 },
  instructionStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  stepDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, marginRight: 10 },
  instructionText: { flex: 1, fontSize: 13, lineHeight: 18 },
  divider: { height: 1, marginVertical: 4 },
  
  // NEW INFO BOX STYLES
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 5,
    marginBottom: 40,
    alignItems: 'flex-start',
  },
  infoBoxIcon: {
    marginRight: 10,
    marginTop: 2, // Aligns icon slightly down to match the first line of text
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});