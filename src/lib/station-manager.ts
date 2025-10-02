import { Observatory } from './types';
import { HRFCOAPIClient } from './hrfco-api';

export interface StationInfo {
  code: string;
  name: string;
  type: 'waterlevel' | 'rainfall' | 'dam';
  location?: string;
  river_name?: string;
}

export class StationManager {
  private static instance: StationManager;
  private stationCache: Map<string, StationInfo[]> = new Map();
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1시간
  private client: HRFCOAPIClient;

  private constructor() {
    this.client = new HRFCOAPIClient();
  }

  static getInstance(): StationManager {
    if (!this.instance) {
      this.instance = new StationManager();
    }
    return this.instance;
  }

  /**
   * 모든 관측소 정보를 가져오고 캐싱
   */
  private async fetchAllStations(): Promise<void> {
    const now = Date.now();
    
    // 캐시가 유효하면 스킵
    if (this.lastFetchTime && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return;
    }

    console.log('🔄 관측소 목록 갱신 중...');
    
    const types: Array<'waterlevel' | 'rainfall' | 'dam'> = ['waterlevel', 'rainfall', 'dam'];
    
    for (const type of types) {
      try {
        const stations = await this.client.getObservatories(type);
        const stationInfos: StationInfo[] = stations.map(station => ({
          code: station.obs_code,
          name: station.obs_name,
          type: type,
          location: station.location,
          river_name: station.river_name
        }));
        
        this.stationCache.set(type, stationInfos);
        console.log(`✅ ${type} 관측소 ${stationInfos.length}개 로드 완료`);
      } catch (error) {
        console.error(`❌ ${type} 관측소 로드 실패:`, error);
        // 실패해도 계속 진행
      }
    }
    
    this.lastFetchTime = now;
  }

  /**
   * 이름으로 관측소 검색
   */
  async searchByName(query: string, type?: 'waterlevel' | 'rainfall' | 'dam'): Promise<StationInfo[]> {
    await this.fetchAllStations();
    
    const results: StationInfo[] = [];
    const searchTypes = type ? [type] : ['waterlevel', 'rainfall', 'dam'] as const;
    
    for (const searchType of searchTypes) {
      const stations = this.stationCache.get(searchType) || [];
      
      // 정확한 매칭 우선
      const exactMatches = stations.filter(station => 
        station.name === query
      );
      
      if (exactMatches.length > 0) {
        results.push(...exactMatches);
        continue;
      }
      
      // 부분 매칭
      const partialMatches = stations.filter(station => 
        station.name.includes(query) || 
        query.includes(station.name) ||
        (station.location && station.location.includes(query)) ||
        (station.river_name && station.river_name.includes(query))
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
    
    for (const [type, stations] of this.stationCache.entries()) {
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
}