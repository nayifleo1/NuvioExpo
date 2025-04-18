import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  ScrollView,
  useColorScheme,
  Switch
} from 'react-native';
import { stremioService, Manifest } from '../services/stremioService';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../styles';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';

// Extend Manifest type to include logo
interface ExtendedManifest extends Manifest {
  logo?: string;
}

const { width } = Dimensions.get('window');

const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

const AddonsScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [addons, setAddons] = useState<ExtendedManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [addonUrl, setAddonUrl] = useState('');
  const [addonDetails, setAddonDetails] = useState<ExtendedManifest | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [catalogCount, setCatalogCount] = useState(0);
  const [activeAddons, setActiveAddons] = useState(0);
  // Force dark mode
  const isDarkMode = true;

  useEffect(() => {
    loadAddons();
  }, []);

  const loadAddons = async () => {
    try {
      setLoading(true);
      const installedAddons = await stremioService.getInstalledAddonsAsync();
      setAddons(installedAddons);
      setActiveAddons(installedAddons.length);
      
      // Count catalogs
      let totalCatalogs = 0;
      installedAddons.forEach(addon => {
        if (addon.catalogs && addon.catalogs.length > 0) {
          totalCatalogs += addon.catalogs.length;
        }
      });
      
      // Get catalog settings to determine enabled count
      const catalogSettingsJson = await AsyncStorage.getItem('catalog_settings');
      if (catalogSettingsJson) {
        const catalogSettings = JSON.parse(catalogSettingsJson);
        const disabledCount = Object.entries(catalogSettings)
          .filter(([key, value]) => key !== '_lastUpdate' && value === false)
          .length;
        setCatalogCount(totalCatalogs - disabledCount);
      } else {
        setCatalogCount(totalCatalogs);
      }
    } catch (error) {
      logger.error('Failed to load addons:', error);
      Alert.alert('Error', 'Failed to load addons');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddon = async () => {
    if (!addonUrl) {
      Alert.alert('Error', 'Please enter an addon URL');
      return;
    }

    try {
      setInstalling(true);
      // First fetch the addon manifest
      const manifest = await stremioService.getManifest(addonUrl);
      setAddonDetails(manifest);
      setShowConfirmModal(true);
    } catch (error) {
      logger.error('Failed to fetch addon details:', error);
      Alert.alert('Error', 'Failed to fetch addon details');
    } finally {
      setInstalling(false);
    }
  };

  const confirmInstallAddon = async () => {
    if (!addonDetails) return;

    try {
      setInstalling(true);
      await stremioService.installAddon(addonUrl);
      setAddonUrl('');
      setShowConfirmModal(false);
      setAddonDetails(null);
      loadAddons();
      Alert.alert('Success', 'Addon installed successfully');
    } catch (error) {
      logger.error('Failed to install addon:', error);
      Alert.alert('Error', 'Failed to install addon');
    } finally {
      setInstalling(false);
    }
  };

  const handleToggleAddon = (addon: ExtendedManifest, enabled: boolean) => {
    // Logic to enable/disable an addon
    Alert.alert(
      enabled ? 'Disable Addon' : 'Enable Addon',
      `Are you sure you want to ${enabled ? 'disable' : 'enable'} ${addon.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: enabled ? 'Disable' : 'Enable',
          style: enabled ? 'destructive' : 'default',
          onPress: () => {
            // TODO: Implement actual toggle functionality
            Alert.alert('Success', `${addon.name} ${enabled ? 'disabled' : 'enabled'}`);
          },
        },
      ]
    );
  };

  const handleRemoveAddon = (addon: ExtendedManifest) => {
    Alert.alert(
      'Uninstall',
      `Are you sure you want to uninstall ${addon.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: () => {
            stremioService.removeAddon(addon.id);
            loadAddons();
          },
        },
      ]
    );
  };

  const renderAddonItem = ({ item }: { item: ExtendedManifest }) => {
    const types = item.types || [];
    const description = item.description || '';
    // @ts-ignore - some addons might have logo property even though it's not in the type
    const logo = item.logo || null;
    
    // Format the types into a simple category text
    const categoryText = types.length > 0 
      ? types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' • ') 
      : 'No categories';

    return (
      <View>
        <View style={styles.addonHeader}>
          {logo ? (
            <ExpoImage 
              source={{ uri: logo }} 
              style={styles.addonIcon} 
              contentFit="contain"
            />
          ) : (
            <View style={styles.addonIconPlaceholder}>
              <MaterialIcons name="extension" size={22} color={colors.mediumGray} />
            </View>
          )}
          <View style={styles.addonTitleContainer}>
            <Text style={styles.addonName}>{item.name}</Text>
            <View style={styles.addonMetaContainer}>
              <Text style={styles.addonVersion}>v{item.version || '1.0.0'}</Text>
              <Text style={styles.addonDot}>•</Text>
              <Text style={styles.addonCategory}>{categoryText}</Text>
            </View>
          </View>
          <Switch
            value={true} // Default to enabled
            onValueChange={(value) => handleToggleAddon(item, !value)}
            trackColor={{ false: colors.elevation1, true: colors.primary }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.elevation1}
          />
        </View>
        
        <Text style={styles.addonDescription}>
          {description.length > 100 ? description.substring(0, 100) + '...' : description}
        </Text>
      </View>
    );
  };

  const StatsCard = ({ value, label }: { value: number; label: string }) => (
    <View style={styles.statsCard}>
      <Text style={styles.statsValue}>{value}</Text>
      <Text style={styles.statsLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="chevron-left" size={28} color={colors.white} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.headerTitle}>Addons</Text>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Overview Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OVERVIEW</Text>
            <View style={styles.statsContainer}>
              <StatsCard value={addons.length} label="Addons" />
              <View style={styles.statsDivider} />
              <StatsCard value={activeAddons} label="Active" />
              <View style={styles.statsDivider} />
              <StatsCard value={catalogCount} label="Catalogs" />
            </View>
          </View>
          
          {/* Add Addon Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADD NEW ADDON</Text>
            <View style={styles.addAddonContainer}>
              <TextInput
                style={styles.addonInput}
                placeholder="Addon URL"
                placeholderTextColor={colors.mediumGray}
                value={addonUrl}
                onChangeText={setAddonUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity 
                style={[styles.addButton, {opacity: installing || !addonUrl ? 0.6 : 1}]}
                onPress={handleAddAddon}
                disabled={installing || !addonUrl}
              >
                <Text style={styles.addButtonText}>
                  {installing ? 'Loading...' : 'Add Addon'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Installed Addons Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>INSTALLED ADDONS</Text>
            <View style={styles.addonList}>
              {addons.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="extension-off" size={32} color={colors.mediumGray} />
                  <Text style={styles.emptyText}>No addons installed</Text>
                </View>
              ) : (
                addons.map((addon, index) => {
                  const isLast = index === addons.length - 1;
                  return (
                    <View 
                      key={addon.id} 
                      style={[
                        styles.addonItem, 
                        { marginBottom: isLast ? 32 : 16 }
                      ]}
                    >
                      {renderAddonItem({ item: addon })}
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Addon Details Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirmModal(false);
          setAddonDetails(null);
        }}
      >
        <BlurView intensity={80} style={styles.modalContainer} tint="dark">
          <View style={styles.modalContent}>
            {addonDetails && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Install Addon</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowConfirmModal(false);
                      setAddonDetails(null);
                    }}
                  >
                    <MaterialIcons name="close" size={24} color={colors.white} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView 
                  style={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={true}
                >
                  <View style={styles.addonDetailHeader}>
                    {/* @ts-ignore */}
                    {addonDetails.logo ? (
                      <ExpoImage
                        source={{ uri: addonDetails.logo }}
                        style={styles.addonLogo}
                        contentFit="contain"
                      />
                    ) : (
                      <View style={styles.addonLogoPlaceholder}>
                        <MaterialIcons name="extension" size={40} color={colors.mediumGray} />
                      </View>
                    )}
                    <Text style={styles.addonDetailName}>{addonDetails.name}</Text>
                    <Text style={styles.addonDetailVersion}>v{addonDetails.version || '1.0.0'}</Text>
                  </View>
                  
                  <View style={styles.addonDetailSection}>
                    <Text style={styles.addonDetailSectionTitle}>Description</Text>
                    <Text style={styles.addonDetailDescription}>
                      {addonDetails.description || 'No description available'}
                    </Text>
                  </View>
                  
                  {addonDetails.types && addonDetails.types.length > 0 && (
                    <View style={styles.addonDetailSection}>
                      <Text style={styles.addonDetailSectionTitle}>Supported Types</Text>
                      <View style={styles.addonDetailChips}>
                        {addonDetails.types.map((type, index) => (
                          <View key={index} style={styles.addonDetailChip}>
                            <Text style={styles.addonDetailChipText}>{type}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {addonDetails.catalogs && addonDetails.catalogs.length > 0 && (
                    <View style={styles.addonDetailSection}>
                      <Text style={styles.addonDetailSectionTitle}>Catalogs</Text>
                      <View style={styles.addonDetailChips}>
                        {addonDetails.catalogs.map((catalog, index) => (
                          <View key={index} style={styles.addonDetailChip}>
                            <Text style={styles.addonDetailChipText}>
                              {catalog.type} - {catalog.id}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </ScrollView>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setShowConfirmModal(false);
                      setAddonDetails(null);
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.installButton]}
                    onPress={confirmInstallAddon}
                    disabled={installing}
                  >
                    {installing ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.modalButtonText}>Install</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUSBAR_HEIGHT + 8 : 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backText: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.white,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mediumGray,
    marginHorizontal: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    backgroundColor: colors.elevation2,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statsCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    alignSelf: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 13,
    color: colors.mediumGray,
  },
  addAddonContainer: {
    marginHorizontal: 16,
    backgroundColor: colors.elevation2,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addonInput: {
    backgroundColor: colors.elevation1,
    borderRadius: 8,
    padding: 12,
    color: colors.white,
    marginBottom: 16,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  addonList: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    backgroundColor: colors.elevation2,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    marginTop: 8,
    color: colors.mediumGray,
    fontSize: 15,
  },
  addonItem: {
    backgroundColor: colors.elevation2,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addonIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.elevation3,
  },
  addonIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.elevation3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addonTitleContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 16,
  },
  addonName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 2,
  },
  addonMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addonVersion: {
    fontSize: 13,
    color: colors.mediumGray,
  },
  addonDot: {
    fontSize: 13,
    color: colors.mediumGray,
    marginHorizontal: 4,
  },
  addonCategory: {
    fontSize: 13,
    color: colors.mediumGray,
    flex: 1,
  },
  addonDescription: {
    fontSize: 14,
    color: colors.mediumEmphasis,
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 20,
    marginLeft: 48, // Align with title, accounting for icon width
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.elevation2,
    borderRadius: 14,
    width: '85%',
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.elevation3,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.white,
  },
  modalScrollContent: {
    maxHeight: 400,
  },
  addonDetailHeader: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.elevation3,
  },
  addonLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: colors.elevation3,
  },
  addonLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.elevation3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addonDetailName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
    textAlign: 'center',
  },
  addonDetailVersion: {
    fontSize: 14,
    color: colors.mediumGray,
  },
  addonDetailSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.elevation3,
  },
  addonDetailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 8,
  },
  addonDetailDescription: {
    fontSize: 15,
    color: colors.mediumEmphasis,
    lineHeight: 20,
  },
  addonDetailChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addonDetailChip: {
    backgroundColor: colors.elevation3,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addonDetailChipText: {
    fontSize: 13,
    color: colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.elevation3,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.elevation3,
    marginRight: 8,
  },
  installButton: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
});

export default AddonsScreen; 