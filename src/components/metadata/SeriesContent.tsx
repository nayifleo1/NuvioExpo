import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, useWindowDimensions, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../styles/colors';
import { Episode } from '../../types/metadata';
import { tmdbService } from '../../services/tmdbService';
import { storageService } from '../../services/storageService';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface SeriesContentProps {
  episodes: Episode[];
  selectedSeason: number;
  loadingSeasons: boolean;
  onSeasonChange: (season: number) => void;
  onSelectEpisode: (episode: Episode) => void;
  groupedEpisodes?: { [seasonNumber: number]: Episode[] };
  metadata?: { poster?: string; id?: string };
}

// Add placeholder constant at the top
const DEFAULT_PLACEHOLDER = 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Image';
const EPISODE_PLACEHOLDER = 'https://via.placeholder.com/500x280/1a1a1a/666666?text=No+Preview';
const TMDB_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tmdb.new.logo.svg/512px-Tmdb.new.logo.svg.png?20200406190906';

export const SeriesContent: React.FC<SeriesContentProps> = ({
  episodes,
  selectedSeason,
  loadingSeasons,
  onSeasonChange,
  onSelectEpisode,
  groupedEpisodes = {},
  metadata
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width > 768;
  const isDarkMode = useColorScheme() === 'dark';
  const [episodeProgress, setEpisodeProgress] = useState<{ [key: string]: { currentTime: number; duration: number } }>({});

  const loadEpisodesProgress = async () => {
    if (!metadata?.id) return;
    
    const allProgress = await storageService.getAllWatchProgress();
    const progress: { [key: string]: { currentTime: number; duration: number } } = {};
    
    episodes.forEach(episode => {
      const episodeId = episode.stremioId || `${metadata.id}:${episode.season_number}:${episode.episode_number}`;
      const key = `series:${metadata.id}:${episodeId}`;
      if (allProgress[key]) {
        progress[episodeId] = {
          currentTime: allProgress[key].currentTime,
          duration: allProgress[key].duration
        };
      }
    });
    
    setEpisodeProgress(progress);
  };

  // Initial load of watch progress
  useEffect(() => {
    loadEpisodesProgress();
  }, [episodes, metadata?.id]);

  // Refresh watch progress when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadEpisodesProgress();
    }, [episodes, metadata?.id])
  );

  if (loadingSeasons) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centeredText}>Loading episodes...</Text>
      </View>
    );
  }

  if (episodes.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <MaterialIcons name="error-outline" size={48} color="#666" />
        <Text style={styles.centeredText}>No episodes available</Text>
      </View>
    );
  }

  const renderSeasonSelector = () => {
    if (!groupedEpisodes || Object.keys(groupedEpisodes).length <= 1) {
      return null;
    }

    const seasons = Object.keys(groupedEpisodes).map(Number).sort((a, b) => a - b);
    
    return (
      <View style={styles.seasonSelectorWrapper}>
        <Text style={styles.seasonSelectorTitle}>Seasons</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.seasonSelectorContainer}
          contentContainerStyle={styles.seasonSelectorContent}
        >
          {seasons.map(season => {
            const seasonEpisodes = groupedEpisodes[season] || [];
            let seasonPoster = DEFAULT_PLACEHOLDER;
            if (seasonEpisodes[0]?.season_poster_path) {
              const tmdbUrl = tmdbService.getImageUrl(seasonEpisodes[0].season_poster_path, 'w500');
              if (tmdbUrl) seasonPoster = tmdbUrl;
            } else if (metadata?.poster) {
              seasonPoster = metadata.poster;
            }
            
            return (
              <TouchableOpacity
                key={season}
                style={[
                  styles.seasonButton,
                  selectedSeason === season && styles.selectedSeasonButton
                ]}
                onPress={() => onSeasonChange(season)}
              >
                <View style={styles.seasonPosterContainer}>
                  <Image
                    source={{ uri: seasonPoster }}
                    style={styles.seasonPoster}
                    contentFit="cover"
                  />
                  {selectedSeason === season && (
                    <View style={styles.selectedSeasonIndicator} />
                  )}
                </View>
                <Text 
                  style={[
                    styles.seasonButtonText,
                    selectedSeason === season && styles.selectedSeasonButtonText
                  ]}
                >
                  Season {season}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderEpisodeCard = (episode: Episode) => {
    let episodeImage = EPISODE_PLACEHOLDER;
    if (episode.still_path) {
      const tmdbUrl = tmdbService.getImageUrl(episode.still_path, 'w500');
      if (tmdbUrl) episodeImage = tmdbUrl;
    } else if (metadata?.poster) {
      episodeImage = metadata.poster;
    }
    
    const episodeNumber = typeof episode.episode_number === 'number' ? episode.episode_number.toString() : '';
    const seasonNumber = typeof episode.season_number === 'number' ? episode.season_number.toString() : '';
    const episodeString = seasonNumber && episodeNumber ? `S${seasonNumber.padStart(2, '0')}E${episodeNumber.padStart(2, '0')}` : '';
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    };

    const formatRuntime = (runtime: number) => {
      if (!runtime) return null;
      const hours = Math.floor(runtime / 60);
      const minutes = runtime % 60;
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    };

    // Get episode progress
    const episodeId = episode.stremioId || `${metadata?.id}:${episode.season_number}:${episode.episode_number}`;
    const progress = episodeProgress[episodeId];
    const progressPercent = progress ? (progress.currentTime / progress.duration) * 100 : 0;
    
    // Don't show progress bar if episode is complete (>= 95%)
    const showProgress = progress && progressPercent < 95;

    return (
      <TouchableOpacity
        key={episode.id}
        style={[styles.episodeCard, isTablet && styles.episodeCardTablet]}
        onPress={() => onSelectEpisode(episode)}
        activeOpacity={0.7}
      >
        <View style={styles.episodeImageContainer}>
          <Image
            source={{ uri: episodeImage }}
            style={styles.episodeImage}
            contentFit="cover"
          />
          <View style={styles.episodeNumberBadge}>
            <Text style={styles.episodeNumberText}>{episodeString}</Text>
          </View>
          {showProgress && (
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar,
                  { width: `${progressPercent}%` }
                ]} 
              />
            </View>
          )}
          {progressPercent >= 95 && (
            <View style={styles.completedBadge}>
              <MaterialIcons name="check" size={12} color={colors.white} />
            </View>
          )}
        </View>

        <View style={styles.episodeInfo}>
          <View style={styles.episodeHeader}>
            <Text style={styles.episodeTitle} numberOfLines={2}>
              {episode.name}
            </Text>
            <View style={styles.episodeMetadata}>
              {episode.vote_average > 0 && (
                <View style={styles.ratingContainer}>
                  <Image
                    source={{ uri: TMDB_LOGO }}
                    style={styles.tmdbLogo}
                    contentFit="contain"
                  />
                  <Text style={styles.ratingText}>
                    {episode.vote_average.toFixed(1)}
                  </Text>
                </View>
              )}
              {episode.runtime && (
                <View style={styles.runtimeContainer}>
                  <MaterialIcons name="schedule" size={14} color={colors.textMuted} />
                  <Text style={styles.runtimeText}>
                    {formatRuntime(episode.runtime)}
                  </Text>
                </View>
              )}
              {episode.air_date && (
                <Text style={styles.airDateText}>
                  {formatDate(episode.air_date)}
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.episodeOverview} numberOfLines={2}>
            {episode.overview || 'No description available'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View 
        entering={FadeIn.duration(500).delay(100)}
      >
        {renderSeasonSelector()}
      </Animated.View>
      
      <Animated.View 
        entering={FadeIn.duration(500).delay(200)}
      >
        <Text style={styles.sectionTitle}>
          {episodes.length} {episodes.length === 1 ? 'Episode' : 'Episodes'}
        </Text>
        
        <ScrollView 
          style={styles.episodeList}
          contentContainerStyle={[
            styles.episodeListContent,
            isTablet && styles.episodeListContentTablet
          ]}
        >
          {isTablet ? (
            <View style={styles.episodeGrid}>
              {episodes.map((episode, index) => (
                <Animated.View 
                  key={episode.id}
                  entering={FadeIn.duration(400).delay(300 + index * 50)}
                >
                  {renderEpisodeCard(episode)}
                </Animated.View>
              ))}
            </View>
          ) : (
            episodes.map((episode, index) => (
              <Animated.View 
                key={episode.id}
                entering={FadeIn.duration(400).delay(300 + index * 50)}
              >
                {renderEpisodeCard(episode)}
              </Animated.View>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: colors.text,
  },
  episodeList: {
    flex: 1,
  },
  episodeListContent: {
    paddingBottom: 20,
  },
  episodeListContentTablet: {
    paddingHorizontal: 8,
  },
  episodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  episodeCard: {
    flexDirection: 'row',
    backgroundColor: colors.darkBackground,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: 120,
  },
  episodeCardTablet: {
    width: '48%',
    flexDirection: 'column',
    height: 120,
  },
  episodeImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    backgroundColor: colors.darkBackground,
  },
  episodeImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.02 }],
  },
  episodeNumberBadge: {
    position: 'absolute',
    bottom: 8,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 1,
  },
  episodeNumberText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  episodeInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  episodeHeader: {
    marginBottom: 4,
  },
  episodeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  episodeMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tmdbLogo: {
    width: 20,
    height: 14,
  },
  ratingText: {
    color: '#01b4e4',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  airDateText: {
    fontSize: 12,
    color: colors.textMuted,
    opacity: 0.8,
  },
  episodeOverview: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  seasonSelectorWrapper: {
    marginBottom: 20,
  },
  seasonSelectorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.text,
  },
  seasonSelectorContainer: {
    flexGrow: 0,
  },
  seasonSelectorContent: {
    paddingBottom: 8,
  },
  seasonButton: {
    alignItems: 'center',
    marginRight: 16,
    width: 100,
  },
  selectedSeasonButton: {
    opacity: 1,
  },
  seasonPosterContainer: {
    position: 'relative',
    width: 100,
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  seasonPoster: {
    width: '100%',
    height: '100%',
  },
  selectedSeasonIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.primary,
  },
  seasonButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  selectedSeasonButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  progressText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  completedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: colors.success,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  runtimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  runtimeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
}); 