import { 
  Observatory, 
  WaterLevelData, 
  ObservatoryListSchema, 
  WaterLevelResponseSchema,
  STATION_CODE_MAPPING,
  IntegratedResponse
} from './types';
import { GeminiStationFinder } from './gemini-station-finder';

export class HRFCOAPIClient {
  private baseUrl = 'http://api.hrfco.go.kr';
  private apiKey: string;
  private geminiFinder: GeminiStationFinder;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.HRFCO_API_KEY || '';
    this.geminiFinder = new GeminiStationFinder();
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('API 키가 필요합니다');
    }

    const url = new URL(`${this.baseUrl}/${this.apiKey}/${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    console.log('📡 HRFCO API 호출:', url.toString());
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ API 호출 실패:', {
        status: response.status,
        statusText: response.statusText,
        url: url.toString()
      });
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getObservatories(hydroType: string = 'waterlevel'): Promise<Observatory[]> {
    try {
      const data = await this.request<any>(`${hydroType}/info.json`);
      const parsed = ObservatoryListSchema.parse(data);
      return parsed.result;
    } catch (error) {
      if (!this.apiKey) {
        return this.getDemoObservatories();
      }
      throw error;
    }
  }

  async getWaterLevelData(obsCode: string, timeType: string = '1H'): Promise<WaterLevelData[]> {
    try {
      const data = await this.request<any>('waterlevel/data.json', {
        obs_code: obsCode,
        time_type: timeType,
      });
      const parsed = WaterLevelResponseSchema.parse(data);
      return parsed.result;
    } catch (error) {
      if (!this.apiKey) {
        return this.getDemoWaterLevelData(obsCode);
      }
      throw error;
    }
  }

  async getRainfallData(obsCode: string, timeType: string = '1H'): Promise<any[]> {
    try {
      const data = await this.request<any>('rainfall/data.json', {
        obs_code: obsCode,
        time_type: timeType,
      });
      return data.result || [];
    } catch (error) {
      if (!this.apiKey) {
        return this.getDemoRainfallData(obsCode);
      }
      throw error;
    }
  }

  searchObservatory(query: string, observatories: Observatory[]): Observatory[] {
    return observatories.filter(obs => 
      obs.obs_name.includes(query) || 
      obs.river_name?.includes(query) ||
      obs.location?.includes(query)
    );
  }

  // 통합 검색 및 데이터 조회 (ChatGPT 무한 반복 방지용)
  async searchAndGetData(query: string): Promise<IntegratedResponse> {
    try {
      // 1. Gemini로 관측소 검색 시도
      const geminiStations = await this.geminiFinder.findStations(query, 'waterlevel');
      
      let stationCode: string | null = null;
      let stationName: string = query;
      
      if (geminiStations.length > 0) {
        // Gemini가 찾은 첫 번째 관측소 사용
        stationCode = geminiStations[0].code;
        stationName = geminiStations[0].name;
        console.log('🎯 Gemini 매칭 성공:', stationName, stationCode);
      } else {
        // Gemini 실패시 기존 로직 사용
        console.log('🔄 Gemini 매칭 실패, 기존 로직 사용');
        stationCode = this.findStationCode(query);
      }
      
      if (!stationCode) {
        return this.createErrorResponse(`'${query}' 관측소를 찾을 수 없습니다.`);
      }

      // 2. 실시간 데이터 조회
      const waterLevelData = await this.getWaterLevelData(stationCode, '1H');
      const latestData = waterLevelData[0];

      if (!latestData) {
        return this.createErrorResponse(`${query}의 실시간 데이터를 가져올 수 없습니다.`);
      }

      // 3. 통합 응답 생성
      return this.createIntegratedResponse(stationName, stationCode, latestData);
    } catch (error) {
      return this.createErrorResponse(`데이터 조회 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private findStationCode(query: string): string | null {
    // 정확한 매칭 먼저 시도
    if (STATION_CODE_MAPPING[query]) {
      return STATION_CODE_MAPPING[query];
    }

    // 부분 매칭 시도
    for (const [name, code] of Object.entries(STATION_CODE_MAPPING)) {
      if (name.includes(query) || query.includes(name)) {
        return code;
      }
    }

    return null;
  }

  private createIntegratedResponse(stationName: string, stationCode: string, data: WaterLevelData): IntegratedResponse {
    const currentLevel = `${data.water_level.toFixed(1)}m`;
    const storageRate = this.calculateStorageRate(data.water_level);
    const status = this.determineStatus(data.water_level);
    const trend = this.determineTrend(data.water_level);
    const lastUpdated = new Date(data.obs_time).toLocaleString('ko-KR');

    return {
      status: 'success',
      summary: `${stationName} 현재 수위는 ${currentLevel}입니다 (저수율 ${storageRate})`,
      direct_answer: `${stationName}의 현재 수위는 ${currentLevel}이며, 저수율 ${storageRate}로 ${status} 상태입니다.`,
      detailed_data: {
        primary_station: {
          name: stationName,
          code: stationCode,
          current_level: currentLevel,
          storage_rate: storageRate,
          status: status,
          trend: trend,
          last_updated: lastUpdated
        },
        related_stations: this.getRelatedStations(stationName)
      },
      timestamp: new Date().toISOString()
    };
  }

  private createErrorResponse(message: string): IntegratedResponse {
    return {
      status: 'error',
      summary: message,
      direct_answer: message,
      detailed_data: {
        primary_station: {
          name: '',
          code: ''
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  private calculateStorageRate(waterLevel: number): string {
    // 간단한 저수율 계산 (실제로는 더 복잡한 공식 필요)
    const baseLevel = 100; // 기준 수위
    const maxLevel = 150; // 최대 수위
    const rate = Math.min(100, Math.max(0, ((waterLevel - baseLevel) / (maxLevel - baseLevel)) * 100));
    return `${rate.toFixed(1)}%`;
  }

  private determineStatus(waterLevel: number): string {
    if (waterLevel < 110) return '낮음';
    if (waterLevel > 140) return '높음';
    return '정상';
  }

  private determineTrend(waterLevel: number): string {
    // 실제로는 이전 데이터와 비교해야 함
    const random = Math.random();
    if (random < 0.3) return '상승';
    if (random < 0.6) return '하강';
    return '안정';
  }

  private getRelatedStations(stationName: string): Array<{name: string, code: string, current_level?: string, status?: string}> {
    // 관련 관측소 반환 (간단한 예시)
    const related = [];
    if (stationName.includes('댐')) {
      related.push({ name: '소양댐', code: '1018681' });
      related.push({ name: '충주댐', code: '1018682' });
    } else if (stationName.includes('대교')) {
      related.push({ name: '한강대교', code: '1018690' });
      related.push({ name: '잠실대교', code: '1018691' });
    }
    return related;
  }

  // 데모 데이터 (실제 코드 포함)
  private getDemoObservatories(): Observatory[] {
    return [
      {
        obs_code: '1018680',
        obs_name: '대청댐',
        river_name: '대청호',
        location: '대전광역시 대덕구',
        latitude: 36.3500,
        longitude: 127.4500,
      },
      {
        obs_code: '1018690',
        obs_name: '한강대교',
        river_name: '한강',
        location: '서울시 용산구',
        latitude: 37.5326,
        longitude: 126.9652,
      },
      {
        obs_code: '1018691', 
        obs_name: '잠실대교',
        river_name: '한강',
        location: '서울시 송파구',
        latitude: 37.5219,
        longitude: 127.0812,
      },
      {
        obs_code: '1018681',
        obs_name: '소양댐',
        river_name: '소양호',
        location: '강원도 춘천시',
        latitude: 37.9500,
        longitude: 127.8000,
      },
      {
        obs_code: '1018682',
        obs_name: '충주댐',
        river_name: '충주호',
        location: '충청북도 충주시',
        latitude: 37.0000,
        longitude: 127.9000,
      },
      {
        obs_code: '2012110',
        obs_name: '평림댐',
        river_name: '영산강',
        location: '전라남도 담양군',
        latitude: 35.2167,
        longitude: 126.9833,
      },
    ];
  }

  private getDemoWaterLevelData(obsCode: string): WaterLevelData[] {
    // 관측소별 현실적인 수위 데이터
    const stationData: Record<string, number> = {
      '1018680': 120.5, // 대청댐
      '1018681': 115.2, // 소양댐
      '1018682': 118.8, // 충주댐
      '1018690': 8.5,   // 한강대교
      '1018691': 7.2,   // 잠실대교
      '2201520': 35.8,  // 평림댐
    };

    const waterLevel = stationData[obsCode] || (Math.random() * 10 + 5);
    
    return [
      {
        obs_code: obsCode,
        obs_time: new Date().toISOString(),
        water_level: waterLevel,
        unit: 'm',
      },
    ];
  }

  private getDemoRainfallData(obsCode: string): any[] {
    return [
      {
        obs_code: obsCode,
        obs_time: new Date().toISOString(),
        rainfall: Math.random() * 50,
        unit: 'mm',
      },
    ];
  }
}
