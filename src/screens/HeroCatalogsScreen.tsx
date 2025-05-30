import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  useColorScheme,
  ActivityIndicator,
  Alert,
  Animated
} from 'react-native';
import { useSettings, settingsEmitter } from '../hooks/useSettings';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { catalogService, StreamingAddon } from '../services/catalogService';
import { useCustomCatalogNames } from '../hooks/useCustomCatalogNames';

const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

interface CatalogItem {
  id: string; // Combined ID in format: addonId:type:catalogId
  name: string;
  addonName: string;
  type: string;
}

const HeroCatalogsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark' || settings.enableDarkMode;
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>(settings.selectedHeroCatalogs || []);
  const { getCustomName, isLoadingCustomNames } = useCustomCatalogNames();
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Ensure selected catalogs state is refreshed whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      setSelectedCatalogs(settings.selectedHeroCatalogs || []);
    }, [settings.selectedHeroCatalogs])
  );

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = settingsEmitter.addListener(() => {
      // Refresh selected catalogs when settings change
      setSelectedCatalogs(settings.selectedHeroCatalogs || []);
    });
    
    return unsubscribe;
  }, [settings.selectedHeroCatalogs]);

  // Fade in/out animation for the "Changes saved" indicator
  useEffect(() => {
    if (showSavedIndicator) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.delay(1500),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start(() => setShowSavedIndicator(false));
    }
  }, [showSavedIndicator, fadeAnim]);

  const handleSave = useCallback(() => {
    // First update the settings
    updateSetting('selectedHeroCatalogs', selectedCatalogs);
    
    // Show the confirmation indicator
    setShowSavedIndicator(true);
    
    // Short delay before navigating back to allow settings to save
    // and the user to see the confirmation message
    setTimeout(() => {
      navigation.goBack();
    }, 800);
  }, [navigation, selectedCatalogs, updateSetting]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Load all available catalogs
  useEffect(() => {
    const loadCatalogs = async () => {
      setLoading(true);
      try {
        const addons = await catalogService.getAllAddons();
        const catalogItems: CatalogItem[] = [];
        
        addons.forEach(addon => {
          if (addon.catalogs && addon.catalogs.length > 0) {
            addon.catalogs.forEach(catalog => {
              catalogItems.push({
                id: `${addon.id}:${catalog.type}:${catalog.id}`,
                name: catalog.name,
                addonName: addon.name,
                type: catalog.type,
              });
            });
          }
        });
        
        setCatalogs(catalogItems);
      } catch (error) {
        console.error('Failed to load catalogs:', error);
        Alert.alert('Error', 'Failed to load catalogs');
      } finally {
        setLoading(false);
      }
    };
    
    loadCatalogs();
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedCatalogs(catalogs.map(catalog => catalog.id));
  }, [catalogs]);

  const handleSelectNone = useCallback(() => {
    setSelectedCatalogs([]);
  }, []);

  const toggleCatalog = useCallback((catalogId: string) => {
    setSelectedCatalogs(prev => {
      if (prev.includes(catalogId)) {
        return prev.filter(id => id !== catalogId);
      } else {
        return [...prev, catalogId];
      }
    });
  }, []);

  // Group catalogs by addon
  const catalogsByAddon: Record<string, CatalogItem[]> = {};
  catalogs.forEach(catalog => {
    if (!catalogsByAddon[catalog.addonName]) {
      catalogsByAddon[catalog.addonName] = [];
    }
    catalogsByAddon[catalog.addonName].push(catalog);
  });

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? colors.darkBackground : '#F2F2F7' }
    ]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons 
            name="arrow-back" 
            size={24} 
            color={isDarkMode ? colors.highEmphasis : colors.textDark} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? colors.highEmphasis : colors.textDark }]}>
          Hero Section Catalogs
        </Text>
      </View>

      {/* Saved indicator */}
      <Animated.View 
        style={[
          styles.savedIndicator, 
          { 
            opacity: fadeAnim,
            backgroundColor: isDarkMode ? 'rgba(0, 180, 150, 0.9)' : 'rgba(0, 180, 150, 0.9)'
          }
        ]}
        pointerEvents="none"
      >
        <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
        <Text style={styles.savedIndicatorText}>Settings Saved</Text>
      </Animated.View>

      {loading || isLoadingCustomNames ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: isDarkMode ? colors.mediumEmphasis : colors.textMutedDark }]}>
            Loading catalogs...
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.actionBar}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: isDarkMode ? colors.elevation2 : colors.white }]} 
              onPress={handleSelectAll}
            >
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: isDarkMode ? colors.elevation2 : colors.white }]} 
              onPress={handleSelectNone}
            >
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: colors.primary }]} 
              onPress={handleSave}
            >
              <MaterialIcons name="save" size={16} color={colors.white} style={styles.saveIcon} />
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={[styles.infoText, { color: isDarkMode ? colors.mediumEmphasis : colors.textMutedDark }]}>
              Select which catalogs to display in the hero section. If none are selected, all catalogs will be used. Don't forget to press Save when you're done.
            </Text>
          </View>

          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {Object.entries(catalogsByAddon).map(([addonName, addonCatalogs]) => (
              <View key={addonName} style={styles.addonSection}>
                <Text style={[styles.addonName, { color: isDarkMode ? colors.highEmphasis : colors.textDark }]}>
                  {addonName}
                </Text>
                <View style={[
                  styles.catalogsContainer, 
                  { backgroundColor: isDarkMode ? colors.elevation1 : colors.white }
                ]}>
                  {addonCatalogs.map(catalog => {
                    const [addonId, type, catalogId] = catalog.id.split(':');
                    const displayName = getCustomName(addonId, type, catalogId, catalog.name);
                    
                    return (
                      <TouchableOpacity
                        key={catalog.id}
                        style={[
                          styles.catalogItem,
                          { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }
                        ]}
                        onPress={() => toggleCatalog(catalog.id)}
                      >
                        <View style={styles.catalogInfo}>
                          <Text style={[styles.catalogName, { color: isDarkMode ? colors.highEmphasis : colors.textDark }]}>
                            {displayName}
                          </Text>
                          <Text style={[styles.catalogType, { color: isDarkMode ? colors.mediumEmphasis : colors.textMutedDark }]}>
                            {catalog.type === 'movie' ? 'Movies' : 'TV Shows'}
                          </Text>
                        </View>
                        <MaterialIcons
                          name={selectedCatalogs.includes(catalog.id) ? "check-box" : "check-box-outline-blank"}
                          size={24}
                          color={selectedCatalogs.includes(catalog.id) ? colors.primary : isDarkMode ? colors.mediumEmphasis : colors.textMutedDark}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUSBAR_HEIGHT + 12 : 8,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  saveIcon: {
    marginRight: 6,
  },
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoText: {
    fontSize: 14,
  },
  addonSection: {
    marginBottom: 16,
  },
  addonName: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  catalogsContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  catalogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  catalogInfo: {
    flex: 1,
  },
  catalogName: {
    fontSize: 16,
    fontWeight: '500',
  },
  catalogType: {
    fontSize: 14,
    marginTop: 2,
  },
  savedIndicator: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 60 : 90,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  savedIndicatorText: {
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: '600',
  },
});

export default HeroCatalogsScreen; 