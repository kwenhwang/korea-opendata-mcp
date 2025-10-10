import type { Logger } from '../utils/logger';
import { logger as defaultLogger } from '../utils/logger';
import { BaseAPI } from './base/BaseAPI';
import { loadAPIConfig } from './base/config';
import type { AuthContext, RequestOptions } from './base/types';
import { AuthStrategy, type APIConfig } from './base/types';
import {
  Observatory,
  WaterLevelData,
  STATION_CODE_MAPPING,
  IntegratedResponse,
  RainfallData,
  type StationType,
} from './types/floodcontrol.types';
import { StationManager } from '../lib/station-manager';

const DEFAULT_BASE_URL = 'http://api.hrfco.go.kr';

export interface FloodControlConfig extends APIConfig {}

type FloodControlRawResponse = unknown;

type DamRealtimeRecord = {
  dmobscd: string;
  swl: string;
  inf?: string;
  tototf?: string;
  sfw?: string;
  ecpc?: string;
  ymdhm?: string;
};

type DamInfoRecord = {
  dmobscd: string;
  pfh?: string;
  fldlmtwl?: string;
};

type WaterLevelRecord = {
  wlobscd: string;
  wl: string;
  ymdhm?: string;
};

type RainfallRecord = {
  rfobscd: string;
  rf?: string;
  ymdhm?: string;
  obsnm?: string;
  obsname?: string;
  obs_nm?: string;
  rfobsnm?: string;
  rf_sum_1h?: string;
  rf_sum_24h?: string;
  rf_sum_12h?: string;
  rf_sum_6h?: string;
  [key: string]: string | undefined;
};

type PrimaryStation = IntegratedResponse['detailed_data']['primary_station'];
type WaterLevelStation = NonNullable<IntegratedResponse['detailed_data']['water_level_station']>;

type ObservatoryRawRecord = {
  wlobscd?: string;
  rfobscd?: string;
  dmobscd?: string;
  obsnm?: string;
  rfobsnm?: string;
  damnm?: string;
  river_name?: string;
  rivername?: string;
  addr?: string;
  location?: string;
  lat?: string;
  lon?: string;
  agcnm?: string;
  gdt?: string;
  attwl?: string;
  wrnwl?: string;
  almwl?: string;
  srswl?: string;
  pfh?: string;
};

export class FloodControlAPI extends BaseAPI<FloodControlConfig, FloodControlRawResponse> {
  constructor(overrides: Partial<FloodControlConfig> = {}, logger: Logger = defaultLogger) {
    const resolvedKey = overrides.apiKey ?? process.env.HRFCO_API_KEY;

    const config = loadAPIConfig('HRFCO', {
      overrides: {
        baseUrl: DEFAULT_BASE_URL,
        authStrategy: AuthStrategy.CustomKey,
        apiKey: resolvedKey,
        ...overrides,
      },
      logger,
    }) as FloodControlConfig;

    super(config, logger);
  }

  protected getBaseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }

  protected authenticate(context: AuthContext): AuthContext {
    const apiKey = this.config.apiKey ?? process.env.HRFCO_API_KEY;
    if (!apiKey) {
      throw new Error('홍수통제소 API 키 (HRFCO_API_KEY)가 필요합니다.');
    }

    const params = { ...context.params };

    if (this.config.authStrategy === AuthStrategy.ServiceKey) {
      params.serviceKey = apiKey;
    }

    return {
      params,
      headers: context.headers,
    };
  }

  protected parseResponse(data: unknown): unknown {
    return data;
  }

  protected async request<T = unknown>(options: RequestOptions): Promise<T> {
    const endpoint = this.composeEndpoint(options.endpoint);
    const response = await super.request({
      ...options,
      endpoint,
      expects: options.expects ?? 'json',
    });
    return response as T;
  }

  async getObservatories(hydroType: StationType = 'waterlevel'): Promise<Observatory[]> {
    const data = await this.request<{ content?: ObservatoryRawRecord[] }>({
      endpoint: `${hydroType}/info.json`,
    });
    const records = Array.isArray(data?.content) ? data.content : [];

    const observatories: Observatory[] = records
      .filter((item): item is ObservatoryRawRecord => Boolean(item))
      .map(item => ({
        obs_code: item.wlobscd || item.rfobscd || item.dmobscd || '',
        obs_name: item.obsnm || item.rfobsnm || item.damnm || (item.rfobscd ? `강우량관측소_${item.rfobscd}` : ''),
        river_name: item.river_name || item.rivername,
        location: item.addr || item.location,
        latitude: this.convertDMSToDecimal(item.lat),
        longitude: this.convertDMSToDecimal(item.lon),
        agency: item.agcnm,
        ground_level: item.gdt ? parseFloat(item.gdt) : undefined,
        warning_levels: item.attwl || item.wrnwl || item.almwl || item.srswl || item.pfh
          ? {
              attention: item.attwl ? parseFloat(item.attwl) : undefined,
              warning: item.wrnwl ? parseFloat(item.wrnwl) : undefined,
              alarm: item.almwl ? parseFloat(item.almwl) : undefined,
              serious: item.srswl ? parseFloat(item.srswl) : undefined,
              flood_control: item.pfh ? parseFloat(item.pfh) : undefined,
            }
          : undefined,
        hydro_type: hydroType,
      }))
      .filter(obs => obs.obs_code && obs.obs_name);

    return observatories;
  }

  async getRainfallStations(): Promise<Observatory[]> {
    return this.getObservatories('rainfall');
  }

  async getStationList(endpoint: string): Promise<any[]> {
    const data = await this.request<any>({ endpoint });
    let stations: any[] = [];

    if (data?.result) stations = data.result;
    else if (data?.content) stations = data.content;
    else if (data?.data) stations = data.data;
    else if (Array.isArray(data)) stations = data;
    else {
      this.logger.warn('Unknown API response structure', { endpoint, keys: Object.keys(data ?? {}) });
      return [];
    }

    return stations.map((station: any) => {
      if (endpoint.includes('waterlevel')) {
        return {
          obs_code: station.wlobscd,
          obs_name: station.obsnm,
          location: station.addr,
          wl_obs_code: station.wlobscd,
          wl_obs_name: station.obsnm,
        };
      }
      if (endpoint.includes('rainfall')) {
        return {
          obs_code: station.rfobscd,
          obs_name: station.rfobsnm || `강우량관측소_${station.rfobscd}`,
          location: station.addr,
          rf_obs_code: station.rfobscd,
          rf_obs_name: station.rfobsnm || `강우량관측소_${station.rfobscd}`,
        };
      }
      if (endpoint.includes('dam')) {
        return {
          obs_code: station.dmobscd,
          obs_name: station.damnm || `댐_${station.dmobscd}`,
          location: station.addr,
          damcode: station.dmobscd,
          damnm: station.damnm || `댐_${station.dmobscd}`,
        };
      }
      return station;
    });
  }

  async getWaterLevelData(
    obsCode: string,
    timeType: string = '1H',
    snapshot?: WaterLevelRecord[],
  ): Promise<WaterLevelData[]> {
    void timeType;

    const records = snapshot ?? (await this.fetchWaterLevelSnapshot());
    const result = this.resolveWaterLevelRecord(records, [obsCode]);

    if (!result) {
      throw new Error(`관측소 ${obsCode}의 데이터를 찾을 수 없습니다`);
    }

    return [result.data];
  }

  async getRainfallData(obsCode: string, snapshot?: RainfallRecord[]): Promise<RainfallData> {
    const records = snapshot ?? (await this.fetchRainfallSnapshot());
    const result = this.resolveRainfallRecord(records, [obsCode]);

    if (!result) {
      throw new Error(`관측소 ${obsCode}의 강수량 데이터를 찾을 수 없습니다`);
    }

    return result.data;
  }

  async getDamData(
    obsCode: string,
    snapshots?: { realtime: DamRealtimeRecord[]; info: DamInfoRecord[] },
  ): Promise<any[]> {
    const damSnapshots = snapshots ?? (await this.fetchDamSnapshots());
    const result = this.resolveDamRecord(damSnapshots, [obsCode]);

    if (!result) {
      throw new Error(`댐 ${obsCode}의 데이터를 찾을 수 없습니다`);
    }

    return [result.data];
  }

  searchObservatory(query: string, observatories: Observatory[]): Observatory[] {
    return observatories.filter(obs =>
      obs.obs_name.includes(query) ||
      obs.river_name?.includes(query) ||
      obs.location?.includes(query)
    );
  }

  async searchAndGetData(query: string): Promise<IntegratedResponse> {
    try {
      const stationManager = StationManager.getInstance(this, { logger: this.logger });
      
      // 스마트 키워드 감지: 강수량 관련 키워드가 있으면 우량관측소 우선 검색
      const rainfallKeywords = ['우량', '강수', '비', '강수량', '강우', 'rainfall'];
      const isRainfallQuery = rainfallKeywords.some(keyword => query.includes(keyword));
      
      // 댐 관련 키워드 감지
      const damKeywords = ['댐', 'dam'];
      const isDamQuery = damKeywords.some(keyword => query.includes(keyword));
      
      // 수위 관련 키워드 감지
      const waterLevelKeywords = ['수위', 'waterlevel', 'water level'];
      const isWaterLevelQuery = waterLevelKeywords.some(keyword => query.includes(keyword));

      const searchResults = await stationManager.searchByName(query);

      let waterSnapshot: WaterLevelRecord[] | null = null;
      let rainfallSnapshot: RainfallRecord[] | null = null;
      let damSnapshots: { realtime: DamRealtimeRecord[]; info: DamInfoRecord[] } | null = null;

      const getWaterSnapshot = async () => {
        if (!waterSnapshot) {
          waterSnapshot = await this.fetchWaterLevelSnapshot();
        }
        return waterSnapshot;
      };

      const getRainfallSnapshot = async () => {
        if (!rainfallSnapshot) {
          rainfallSnapshot = await this.fetchRainfallSnapshot();
        }
        return rainfallSnapshot;
      };

      const getDamSnapshots = async () => {
        if (!damSnapshots) {
          damSnapshots = await this.fetchDamSnapshots();
        }
        return damSnapshots;
      };

      if (searchResults.length === 0) {
        // 키워드 기반 우선순위 검색
        if (isRainfallQuery) {
          // 강수량 키워드가 있으면 우량관측소 우선 검색
          const rainfallCodes = this.collectCandidateCodes(query, 'rainfall', query);
          const rainfallResult = this.resolveRainfallRecord(await getRainfallSnapshot(), rainfallCodes);
          if (rainfallResult) {
            return this.createIntegratedRainfallResponse(
              query,
              rainfallResult.code,
              rainfallResult.data,
            );
          }
        }
        
        if (isDamQuery) {
          // 댐 키워드가 있으면 댐 우선 검색
          const [damResult, waterResult] = await Promise.all([
            (async () => {
              const snapshots = await getDamSnapshots();
              const codes = this.collectCandidateCodes(query, 'dam', query);
              return this.resolveDamRecord(snapshots, codes);
            })(),
            (async () => {
              const snapshot = await getWaterSnapshot();
              const codes = this.collectCandidateCodes(query, 'waterlevel', query);
              return this.resolveWaterLevelRecord(snapshot, codes);
            })(),
          ]);

          if (damResult || waterResult) {
            return this.createIntegratedDamResponse(
              query,
              damResult?.code ?? waterResult?.code ?? '',
              waterResult?.code ?? damResult?.code ?? '',
              damResult?.data ?? null,
              waterResult?.data ?? null,
            );
          }
        }
        
        if (isWaterLevelQuery) {
          // 수위 키워드가 있으면 수위관측소 우선 검색
          const waterCodes = this.collectCandidateCodes(query, 'waterlevel', query);
          const waterResult = this.resolveWaterLevelRecord(await getWaterSnapshot(), waterCodes);
          if (waterResult) {
            return this.createIntegratedResponse(query, waterResult.code, waterResult.data);
          }
        }

        // 키워드가 없거나 매칭되지 않으면 기존 순서로 검색
        const waterCodes = this.collectCandidateCodes(query, 'waterlevel', query);
        const waterResult = this.resolveWaterLevelRecord(await getWaterSnapshot(), waterCodes);
        if (waterResult) {
          return this.createIntegratedResponse(query, waterResult.code, waterResult.data);
        }

        const rainfallCodes = this.collectCandidateCodes(query, 'rainfall', query);
        const rainfallResult = this.resolveRainfallRecord(await getRainfallSnapshot(), rainfallCodes);
        if (rainfallResult) {
          return this.createIntegratedRainfallResponse(
            query,
            rainfallResult.code,
            rainfallResult.data,
          );
        }

        return this.createErrorResponse(`'${query}' 관측소 정보를 찾을 수 없습니다.`);
      }

      // 키워드 기반 우선순위로 검색 결과 처리
      const prioritizedResults = this.prioritizeSearchResults(searchResults, isRainfallQuery, isDamQuery, isWaterLevelQuery);
      
      for (const station of prioritizedResults) {
        this.logger.debug('Evaluating station candidate', { station });

        if (station.type === 'dam') {
          const damResult = this.resolveDamRecord(
            await getDamSnapshots(),
            this.collectCandidateCodes(station.name, 'dam', station.code, query),
          );
          const waterResult = this.resolveWaterLevelRecord(
            await getWaterSnapshot(),
            this.collectCandidateCodes(station.name, 'waterlevel', query),
          );

          if (damResult || waterResult) {
            return this.createIntegratedDamResponse(
              station.name,
              damResult?.code ?? station.code,
              waterResult?.code ?? damResult?.code ?? station.code,
              damResult?.data ?? null,
              waterResult?.data ?? null,
            );
          }

          continue;
        }

        if (station.type === 'rainfall') {
          const rainfallResult = this.resolveRainfallRecord(
            await getRainfallSnapshot(),
            this.collectCandidateCodes(station.name, 'rainfall', station.code, query),
          );

          if (rainfallResult) {
            return this.createIntegratedRainfallResponse(
              station.name,
              rainfallResult.code,
              rainfallResult.data,
            );
          }

          const waterResult = this.resolveWaterLevelRecord(
            await getWaterSnapshot(),
            this.collectCandidateCodes(station.name, 'waterlevel', query),
          );

          if (waterResult) {
            return this.createIntegratedResponse(station.name, waterResult.code, waterResult.data);
          }

          continue;
        }

        const waterResult = this.resolveWaterLevelRecord(
          await getWaterSnapshot(),
          this.collectCandidateCodes(station.name, 'waterlevel', station.code, query),
        );

        if (waterResult) {
          return this.createIntegratedResponse(station.name, waterResult.code, waterResult.data);
        }

        const rainfallResult = this.resolveRainfallRecord(
          await getRainfallSnapshot(),
          this.collectCandidateCodes(station.name, 'rainfall', query),
        );

        if (rainfallResult) {
          return this.createIntegratedRainfallResponse(
            station.name,
            rainfallResult.code,
            rainfallResult.data,
          );
        }
      }

      return this.createErrorResponse(`${query}의 실시간 데이터를 가져올 수 없습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`데이터 조회 중 오류가 발생했습니다: ${message}`);
    }
  }

  private composeEndpoint(endpoint: string): string {
    const trimmed = endpoint.replace(/^\//, '');

    if (this.config.authStrategy === AuthStrategy.ServiceKey) {
      return trimmed;
    }

    const apiKey = this.config.apiKey ?? this.config.serviceKey ?? process.env.HRFCO_API_KEY;
    if (!apiKey) {
      throw new Error('홍수통제소 API 키 (HRFCO_API_KEY)가 필요합니다.');
    }

    return `${apiKey}/${trimmed}`;
  }

  private convertDMSToDecimal(dmsString?: string): number {
    if (!dmsString || dmsString.trim() === '') return 0;
    const parts = dmsString.trim().split('-').map(part => parseFloat(part.trim()));
    if (parts.length !== 3 || parts.some(part => Number.isNaN(part))) return 0;
    const [degrees, minutes, seconds] = parts;
    return degrees + minutes / 60 + seconds / 3600;
  }

  private findStationCode(query: string, type: 'dam' | 'waterlevel' | 'rainfall' = 'waterlevel'): string | null {
    const mapping = STATION_CODE_MAPPING[type];
    if (!mapping) return null;

    if (mapping[query]) {
      return mapping[query];
    }

    for (const [name, code] of Object.entries(mapping)) {
      if (name.includes(query) || query.includes(name)) {
        return code;
      }
    }

    return null;
  }

  private createIntegratedResponse(stationName: string, stationCode: string, data: WaterLevelData): IntegratedResponse {
    const currentLevel = `${data.water_level.toFixed(1)}m`;
    const status = this.determineStatus(data.water_level);
    const trend = this.determineTrend(data.water_level);
    const lastUpdated = this.parseObsTime(data.obs_time);

    return {
      status: 'success',
      summary: `${stationName} 현재 수위는 ${currentLevel}입니다`,
      direct_answer: `${stationName}의 현재 수위는 ${currentLevel}이며, ${status} 상태입니다.`,
      detailed_data: {
        type: 'waterlevel',
        primary_station: {
          name: stationName,
          code: stationCode,
          current_level: currentLevel,
          status,
          trend,
          last_updated: lastUpdated,
        },
        related_stations: this.getRelatedStations(stationName),
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createIntegratedDamResponse(
    damName: string,
    damCode: string,
    waterLevelCode: string,
    damData: any,
    waterLevelData: any,
  ): IntegratedResponse {
    const primaryData = damData || waterLevelData;
    const currentLevel = `${primaryData.water_level.toFixed(1)}m`;
    const status = this.determineStatus(primaryData.water_level);
    const trend = this.determineTrend(primaryData.water_level);
    const lastUpdated = this.parseObsTime(primaryData.obs_time);

    const damInfo: PrimaryStation = {
      name: damName,
      code: damCode,
      current_level: currentLevel,
      status,
      trend,
      last_updated: lastUpdated,
    };

    if (damData) {
      damInfo.inflow = `${damData.inflow.toFixed(1)}m³/s`;
      damInfo.outflow = `${damData.outflow.toFixed(1)}m³/s`;
      damInfo.current_storage = `${damData.current_storage.toFixed(1)}백만m³`;
      if (damData.water_level_analysis) {
        damInfo.water_level_analysis = damData.water_level_analysis;
        damInfo.flood_limit_level = `${damData.flood_limit_level}m`;
      }
    }

    const waterLevelInfo: WaterLevelStation | undefined = waterLevelData
      ? {
          name: `${damName} 수위관측소`,
          code: waterLevelCode,
          current_level: `${waterLevelData.water_level.toFixed(1)}m`,
          last_updated: this.parseObsTime(waterLevelData.obs_time),
        }
      : undefined;

    let directAnswer = `${damName}의 현재 수위는 ${currentLevel}이며, ${status} 상태입니다.`;
    if (damData) {
      directAnswer += ` 유입량은 ${damInfo.inflow}, 방류량은 ${damInfo.outflow}입니다.`;
      if (damData.water_level_analysis && damData.water_level_analysis.status !== '정보부족') {
        directAnswer += ` ${damData.water_level_analysis.message}`;
      }
    }

    return {
      status: 'success',
      summary: `${damName} 현재 수위는 ${currentLevel}입니다`,
      direct_answer: directAnswer,
      detailed_data: {
        type: 'dam',
        primary_station: damInfo,
        water_level_station: waterLevelInfo,
        related_stations: this.getRelatedStations(damName),
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createIntegratedRainfallResponse(
    fallbackName: string,
    stationCode: string,
    rainfall: RainfallData,
  ): IntegratedResponse {
    const stationName = rainfall.stationName || fallbackName;
    const currentRainfall = Number.isFinite(rainfall.currentRainfall)
      ? rainfall.currentRainfall
      : 0;
    const summary = `${stationName} 현재 강수량은 ${currentRainfall.toFixed(1)}mm입니다`;
    const detailedMessage = this.formatRainfallMessage({
      ...rainfall,
      stationName,
      stationCode,
    });

    return {
      status: 'success',
      summary,
      direct_answer: detailedMessage,
      detailed_data: {
        type: 'rainfall',
        primary_station: {
          name: stationName,
          code: stationCode,
          current_level: `${currentRainfall.toFixed(1)}mm`,
          current_rainfall: `${currentRainfall.toFixed(1)}mm`,
          status: rainfall.status,
          last_updated: rainfall.timestamp,
        },
        related_stations: this.getRelatedStations(stationName),
        rainfall_details: {
          ...rainfall,
          stationName,
          stationCode,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  private formatRainfallMessage(data: RainfallData): string {
    const emoji = this.getRainfallEmoji(data.status);
    return `🌧️ **${data.stationName} 실시간 강수량 정보**\n\n`
      + `📊 **현재 상태**: ${emoji} ${data.status}\n\n`
      + '📈 **강수량 현황**:\n'
      + `-  현재: ${data.currentRainfall.toFixed(1)}mm\n`
      + `-  1시간 누적: ${data.hourlyRainfall.toFixed(1)}mm\n`
      + `-  일 누적: ${data.dailyRainfall.toFixed(1)}mm\n\n`
      + `🕐 **측정시각**: ${data.timestamp}\n\n`
      + `🔗 **관측소 코드**: ${data.stationCode}`;
  }

  private getRainfallEmoji(status: string): string {
    const mapping: Record<string, string> = {
      강수없음: '☀️',
      약한비: '🌦️',
      보통비: '🌧️',
      강한비: '⛈️',
      매우강한비: '🌩️',
    };
    return mapping[status] ?? '🌧️';
  }

  private getRainfallStatus(rainfall: number): string {
    if (!Number.isFinite(rainfall) || rainfall <= 0) return '강수없음';
    if (rainfall < 1) return '약한비';
    if (rainfall < 3) return '보통비';
    if (rainfall < 5) return '강한비';
    return '매우강한비';
  }

  private createErrorResponse(message: string): IntegratedResponse {
    return {
      status: 'error',
      summary: message,
      direct_answer: message,
      detailed_data: {
        primary_station: {
          name: '',
          code: '',
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  private determineStatus(waterLevel: number): string {
    if (waterLevel < 100) return '낮음';
    if (waterLevel > 112) return '높음';
    return '정상';
  }

  private determineTrend(_waterLevel: number): string {
    const random = Math.random();
    if (random < 0.3) return '상승';
    if (random < 0.6) return '하강';
    return '안정';
  }

  private analyzeWaterLevel(currentLevel: number, floodLimitLevel: number) {
    if (floodLimitLevel <= 0) {
      return {
        status: '정보부족',
        message: '제한수위 정보가 없어 분석할 수 없습니다.',
        level_difference: null,
        percentage_difference: 0,
        risk_level: 'unknown',
        flood_limit_level: floodLimitLevel,
      };
    }

    const difference = currentLevel - floodLimitLevel;
    const percentage = (difference / floodLimitLevel) * 100;

    if (difference > 0) {
      return {
        status: '제한수위 초과',
        message: `현재 수위가 제한수위보다 ${difference.toFixed(1)}m 높습니다 (${percentage.toFixed(1)}% 초과)` ,
        level_difference: difference,
        percentage_difference: percentage,
        risk_level: 'high',
        flood_limit_level: floodLimitLevel,
      };
    }

    if (difference > -1) {
      return {
        status: '제한수위 근접',
        message: `현재 수위가 제한수위보다 ${Math.abs(difference).toFixed(1)}m 낮습니다 (${Math.abs(percentage).toFixed(1)}% 낮음)`,
        level_difference: difference,
        percentage_difference: percentage,
        risk_level: 'medium',
        flood_limit_level: floodLimitLevel,
      };
    }

    return {
      status: '안전',
      message: `현재 수위가 제한수위보다 ${Math.abs(difference).toFixed(1)}m 낮습니다 (${Math.abs(percentage).toFixed(1)}% 낮음)`,
      level_difference: difference,
      percentage_difference: percentage,
      risk_level: 'low',
      flood_limit_level: floodLimitLevel,
    };
  }

  private parseObsTime(obsTime: string): string {
    try {
      if (!obsTime || obsTime.trim() === '') {
        return new Date().toLocaleString('ko-KR');
      }

      if (obsTime.length !== 12 || !/^\d{12}$/.test(obsTime)) {
        this.logger.warn('Invalid obs_time format', { obsTime });
        return new Date().toLocaleString('ko-KR');
      }

      const year = obsTime.slice(0, 4);
      const month = obsTime.slice(4, 6);
      const day = obsTime.slice(6, 8);
      const hour = obsTime.slice(8, 10);
      const minute = obsTime.slice(10, 12);

      const formattedTime = `${year}-${month}-${day} ${hour}:${minute}`;
      const date = new Date(formattedTime);
      if (Number.isNaN(date.getTime())) {
        this.logger.warn('Invalid date generated from obs_time', { formattedTime });
        return new Date().toLocaleString('ko-KR');
      }

      return date.toLocaleString('ko-KR');
    } catch (error) {
      this.logger.error('obs_time parsing failed', { error: error instanceof Error ? error.message : error });
      return new Date().toLocaleString('ko-KR');
    }
  }

  private getRelatedStations(stationName: string): Array<{ name: string; code: string; current_level?: string; status?: string }> {
    const related: Array<{ name: string; code: string; current_level?: string; status?: string }> = [];

    if (stationName.includes('댐')) {
      related.push({ name: '소양댐', code: '1010690' });
      related.push({ name: '충주댐', code: '1003666' });
    } else if (stationName.includes('대교')) {
      related.push({ name: '한강대교', code: '1018683' });
    }

    return related;
  }

  private async fetchWaterLevelSnapshot(): Promise<WaterLevelRecord[]> {
    const data = await this.request<{ content?: WaterLevelRecord[] }>({ endpoint: 'waterlevel/list.json' });
    return Array.isArray(data?.content) ? data.content.filter(Boolean) : [];
  }

  private async fetchRainfallSnapshot(): Promise<RainfallRecord[]> {
    const data = await this.request<{ content?: RainfallRecord[] }>({ endpoint: 'rainfall/list.json' });
    return Array.isArray(data?.content) ? data.content.filter(Boolean) : [];
  }

  private async fetchDamSnapshots(): Promise<{
    realtime: DamRealtimeRecord[];
    info: DamInfoRecord[];
  }> {
    const [realtimeRes, infoRes] = await Promise.all([
      this.request<{ content?: DamRealtimeRecord[] }>({ endpoint: 'dam/list.json' }),
      this.request<{ content?: DamInfoRecord[] }>({ endpoint: 'dam/info.json' }),
    ]);

    return {
      realtime: Array.isArray(realtimeRes?.content) ? realtimeRes.content.filter(Boolean) : [],
      info: Array.isArray(infoRes?.content) ? infoRes.content.filter(Boolean) : [],
    };
  }

  private normalizeCode(value?: string | null): string {
    return (value ?? '').trim();
  }

  /**
   * 키워드 기반으로 검색 결과 우선순위 정렬
   */
  private prioritizeSearchResults(
    searchResults: Array<{ type: string; name: string; code: string }>,
    isRainfallQuery: boolean,
    isDamQuery: boolean,
    isWaterLevelQuery: boolean
  ): Array<{ type: string; name: string; code: string }> {
    if (isRainfallQuery) {
      // 강수량 키워드가 있으면 우량관측소 우선
      return searchResults.sort((a, b) => {
        if (a.type === 'rainfall' && b.type !== 'rainfall') return -1;
        if (a.type !== 'rainfall' && b.type === 'rainfall') return 1;
        return 0;
      });
    }
    
    if (isDamQuery) {
      // 댐 키워드가 있으면 댐 우선
      return searchResults.sort((a, b) => {
        if (a.type === 'dam' && b.type !== 'dam') return -1;
        if (a.type !== 'dam' && b.type === 'dam') return 1;
        return 0;
      });
    }
    
    if (isWaterLevelQuery) {
      // 수위 키워드가 있으면 수위관측소 우선
      return searchResults.sort((a, b) => {
        if (a.type === 'waterlevel' && b.type !== 'waterlevel') return -1;
        if (a.type !== 'waterlevel' && b.type === 'waterlevel') return 1;
        return 0;
      });
    }
    
    // 키워드가 없으면 기존 순서 유지 (dam → rainfall → waterlevel)
    return searchResults.sort((a, b) => {
      const typeOrder = { dam: 0, rainfall: 1, waterlevel: 2 };
      const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 3;
      const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 3;
      return aOrder - bOrder;
    });
  }

  private collectCandidateCodes(
    stationName: string,
    type: StationType,
    ...additional: Array<string | undefined | null>
  ): string[] {
    const candidates = new Set<string>();

    additional.forEach(code => {
      const normalized = this.normalizeCode(code);
      if (normalized) candidates.add(normalized);
    });

    const mapping = this.findStationCode(stationName, type);
    if (mapping) {
      candidates.add(mapping);
    }

    const sanitized = stationName.replace(/\s+/g, '');
    if (sanitized !== stationName) {
      const mappedSanitized = this.findStationCode(sanitized, type);
      if (mappedSanitized) {
        candidates.add(mappedSanitized);
      }
    }

    if (/^\d+$/.test(stationName.trim())) {
      candidates.add(stationName.trim());
    }

    return Array.from(candidates);
  }

  private parseRainfallValue(record: RainfallRecord, keys: string[], fallback = Number.NaN): number {
    for (const key of keys) {
      if (!(key in record)) continue;
      const raw = record[key];
      if (raw === undefined || raw === null) continue;
      const trimmed = String(raw).trim();
      if (trimmed === '') continue;
      const value = parseFloat(trimmed);
      if (!Number.isNaN(value)) {
        return value;
      }
    }

    return fallback;
  }

  private resolveWaterLevelRecord(
    snapshot: WaterLevelRecord[],
    codes: string[],
  ): { code: string; data: WaterLevelData } | null {
    for (const code of codes) {
      const normalized = this.normalizeCode(code);
      const record = snapshot.find(item => this.normalizeCode(item.wlobscd) === normalized);
      if (!record) continue;

      const waterLevel = parseFloat(record.wl);
      if (Number.isNaN(waterLevel) || record.wl === '' || record.wl === ' ') {
        continue;
      }

      return {
        code: normalized,
        data: {
          obs_code: normalized,
          obs_time: record.ymdhm || new Date().toISOString(),
          water_level: waterLevel,
          unit: 'm',
        },
      };
    }

    return null;
  }

  private resolveRainfallRecord(
    snapshot: RainfallRecord[],
    codes: string[],
  ): { code: string; data: RainfallData } | null {
    for (const code of codes) {
      const normalized = this.normalizeCode(code);
      const record = snapshot.find(item => this.normalizeCode(item.rfobscd) === normalized);
      if (!record) continue;

      const currentRainfall = this.parseRainfallValue(record, ['rf', 'rainfall', 'rf_now']);
      if (Number.isNaN(currentRainfall)) {
        continue;
      }

      const hourlyRainfall = this.parseRainfallValue(
        record,
        ['rfSum1h', 'rfsum1h', 'rf1h', 'rf_1h', 'rf_hour', 'rf_sum_1h', 'rnhr1', 'rf1Hour'],
        0,
      );
      const dailyRainfall = this.parseRainfallValue(
        record,
        ['rfSum1d', 'rfsum1d', 'rf1d', 'rf_1d', 'rf_day', 'rf_sum_24h', 'rn24h', 'rfDaily'],
        0,
      );
      const stationName = record.obsnm
        || record.rfobsnm
        || record.obsname
        || record.obs_nm
        || `우량관측소_${normalized}`;

      const timestamp = record.ymdhm && /^\d{12}$/.test(record.ymdhm)
        ? this.parseObsTime(record.ymdhm)
        : new Date().toLocaleString('ko-KR');
      const status = this.getRainfallStatus(currentRainfall);

      return {
        code: normalized,
        data: {
          stationName,
          stationCode: normalized,
          currentRainfall: Number.isNaN(currentRainfall) ? 0 : currentRainfall,
          hourlyRainfall,
          dailyRainfall,
          timestamp,
          status,
        },
      };
    }

    return null;
  }

  private resolveDamRecord(
    snapshots: { realtime: DamRealtimeRecord[]; info: DamInfoRecord[] },
    codes: string[],
  ): { code: string; data: any } | null {
    for (const code of codes) {
      const normalized = this.normalizeCode(code);
      const damData = snapshots.realtime.find(item => this.normalizeCode(item.dmobscd) === normalized);
      if (!damData) continue;

      const damInfo = snapshots.info.find(item => this.normalizeCode(item?.dmobscd) === normalized);
      const waterLevel = parseFloat(damData.swl);
      if (Number.isNaN(waterLevel)) continue;

      const inflow = damData.inf ? parseFloat(damData.inf) : 0;
      const outflow = damData.tototf ? parseFloat(damData.tototf) : 0;
      const currentStorage = damData.sfw ? parseFloat(damData.sfw) : 0;
      const floodControlCapacity = damInfo?.pfh ? parseFloat(damInfo.pfh) : 0;
      const floodLimitLevel = damInfo?.fldlmtwl ? parseFloat(damInfo.fldlmtwl) : 0;

      const waterLevelAnalysis = this.analyzeWaterLevel(waterLevel, floodLimitLevel);

      return {
        code: normalized,
        data: {
          obs_code: normalized,
          obs_time: damData.ymdhm || new Date().toISOString(),
          water_level: waterLevel,
          inflow,
          outflow,
          current_storage: currentStorage,
          flood_control_capacity: floodControlCapacity,
          flood_limit_level: floodLimitLevel,
          water_level_analysis: waterLevelAnalysis,
          unit: 'm',
        },
      };
    }

    return null;
  }
}
