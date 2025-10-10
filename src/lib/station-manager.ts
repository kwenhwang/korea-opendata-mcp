import { Observatory } from './types';
import { KoreaOpenDataAPIClient } from './korea-opendata-api';
import { logger as defaultLogger, Logger } from '../utils/logger';

export interface StationInfo {
  code: string;
  name: string;
  type: 'waterlevel' | 'rainfall' | 'dam';
  location?: string;
  river_name?: string;
}

export interface StationApiClient {
  getObservatories(hydroType?: string): Promise<Observatory[]>;
}

export interface StationManagerOptions {
  cacheDurationMs?: number;
  logger?: Logger;
}

export class StationManager {
  private static instance: StationManager;
  private stationCache: Map<string, StationInfo[]> = new Map();
  private lastFetchTime = 0;
  private cacheDuration: number;
  private logger: Logger;
  private client: StationApiClient;
  private static readonly SEARCH_STOPWORDS = ['우량', '강수', '강우', '비', '관측소', '수위', '정보', '실시간', '조회', '데이터', '측정', '홍수', '댐', '대교'];

  private constructor(client: StationApiClient, options: StationManagerOptions = {}) {
    this.client = client;
    this.cacheDuration = options.cacheDurationMs ?? 60 * 60 * 1000; // default 1 hour
    this.logger = options.logger ?? defaultLogger;
  }

  static getInstance(
    clientOrApiKey?: StationApiClient | string,
    options: StationManagerOptions = {}
  ): StationManager {
    if (!this.instance) {
      if (typeof clientOrApiKey === 'string' || clientOrApiKey === undefined) {
        this.instance = new StationManager(new KoreaOpenDataAPIClient(clientOrApiKey), options);
      } else {
        this.instance = new StationManager(clientOrApiKey, options);
      }
    } else if (clientOrApiKey && typeof clientOrApiKey !== 'string') {
      // allow refreshing the client in existing singleton when explicitly provided
      this.instance.client = clientOrApiKey;
      if (options.logger) {
        this.instance.logger = options.logger;
      }
      if (options.cacheDurationMs) {
        this.instance.cacheDuration = options.cacheDurationMs;
      }
    }
    return this.instance;
  }

  /**
   * 모든 관측소 정보를 가져오고 캐싱
   */
  private async fetchAllStations(): Promise<void> {
    const now = Date.now();

    // 캐시가 유효하면 스킵
    if (this.lastFetchTime && (now - this.lastFetchTime) < this.cacheDuration) {
      return;
    }

    this.logger.info('Refreshing station cache');

    // 각 타입별로 관측소 정보 수집 (이름 정보를 위해 getObservatories 사용)
    const types = ['waterlevel', 'rainfall', 'dam'] as const;

    for (const type of types) {
      try {
        let hydroType = type;
        if (type === 'dam') hydroType = 'dam';  // 댐은 그대로 사용

        const observatories = await this.client.getObservatories(type === 'dam' ? 'dam' : type);

        // 모든 관측소 로딩 (필터링 제거)
        const typeObservatories = observatories.filter(obs => obs.obs_code && obs.obs_name);

        const stationInfos: StationInfo[] = typeObservatories.map(obs => ({
          code: obs.obs_code!,
          name: obs.obs_name || `${type === 'rainfall' ? '강우량' : type === 'dam' ? '댐' : '수위'}관측소_${obs.obs_code}`,
          type: type,
          location: obs.location,
          river_name: obs.river_name
        }));

        this.stationCache.set(type, stationInfos);
        this.logger.debug('Loaded stations', {
          type,
          count: stationInfos.length,
        });
      } catch (error) {
        this.logger.error(`${type} station load failed`, {
          error: error instanceof Error ? error.message : error,
        });
        // 실패해도 계속 진행
      }
    }

    this.lastFetchTime = now;
  }

  /**
   * 이름으로 관측소 검색
   */
  async searchByName(query: string, type?: 'waterlevel' | 'rainfall' | 'dam'): Promise<StationInfo[]> {
    const trimmedQuery = (query ?? '').trim();
    const normalizedQuery = this.normalizeSearchText(trimmedQuery);
    await this.fetchAllStations();

    const results: StationInfo[] = [];
    const searchTypes = type ? [type] : ['waterlevel', 'rainfall', 'dam'] as const;

    for (const searchType of searchTypes) {
      const stations = this.stationCache.get(searchType) || [];

      // 정확한 매칭 우선
      const exactMatches = stations.filter(station =>
        station.name === trimmedQuery
        || this.normalizeSearchText(station.name) === normalizedQuery
      );

      if (exactMatches.length > 0) {
        results.push(...exactMatches);
      }

      const exactMatchCodes = new Set(exactMatches.map(item => item.code));

      // 부분 매칭
      const partialMatches = stations.filter(station => 
        !exactMatchCodes.has(station.code)
        && (
          this.partialMatch(station.name, trimmedQuery, normalizedQuery)
        || this.partialMatch(station.location, trimmedQuery, normalizedQuery)
        || this.partialMatch(station.river_name, trimmedQuery, normalizedQuery)
        )
      );

      results.push(...partialMatches);
    }
    
    // 중복 제거 (같은 코드의 관측소)
    const uniqueResults = Array.from(
      new Map(results.map(item => [item.code, item])).values()
    );
    
    return uniqueResults;
  }

  /**
   * 코드로 관측소 정보 가져오기
   */
  async getByCode(code: string): Promise<StationInfo | null> {
    await this.fetchAllStations();
    
    for (const [type, stations] of Array.from(this.stationCache.entries())) {
      const station = stations.find(s => s.code === code);
      if (station) {
        return station;
      }
    }
    
    return null;
  }

  /**
   * 캐시 강제 갱신
   */
  async refreshCache(): Promise<void> {
    this.lastFetchTime = 0;
    await this.fetchAllStations();
  }

  private normalizeSearchText(value?: string | null): string {
    if (!value) return '';
    let normalized = value
      .replace(/\s+/g, '')
      .replace(/[()\[\]{}]/g, '')
      .replace(/-/g, '')
      .toLowerCase();

    for (const keyword of StationManager.SEARCH_STOPWORDS) {
      if (!keyword) continue;
      normalized = normalized.replace(new RegExp(keyword.toLowerCase(), 'g'), '');
    }

    return normalized;
  }

  private partialMatch(
    source?: string | null,
    rawQuery?: string,
    normalizedQuery?: string,
  ): boolean {
    if (!source) return false;
    const normalizedSource = this.normalizeSearchText(source);
    const trimmedQuery = rawQuery ?? '';
    const normalized = normalizedQuery ?? '';

    const hasRaw = trimmedQuery.length > 0;
    const hasNormalized = normalized.length > 0;
    if (!hasRaw && !hasNormalized) return false;

    return (
      (hasRaw && source.includes(trimmedQuery))
      || (hasRaw && trimmedQuery.includes(source))
      || (hasNormalized && normalizedSource.includes(normalized))
      || (hasNormalized && normalized.includes(normalizedSource))
    );
  }
}
