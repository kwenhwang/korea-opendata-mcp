import type { Logger } from '../utils/logger';
import { logger as defaultLogger } from '../utils/logger';
import { BaseAPI } from './base/BaseAPI';
import { loadAPIConfig } from './base/config';
import type { AuthContext } from './base/types';
import { AuthStrategy, type APIConfig } from './base/types';
import { parseStringPromise } from 'xml2js';
import {
  Observatory,
  WaterLevelData,
  STATION_CODE_MAPPING,
  IntegratedResponse,
  RainfallData,
  type StationType,
} from './types/floodcontrol.types';
import { StationManager } from '../lib/station-manager';
import {
  DAM_CAPACITY_DATA,
  calculateStorageRate,
  getWatershedDams,
  getDamCapacityInfo,
} from './data/damCapacity';
import { TimeSeriesAnalyzer } from './utils/timeSeriesAnalyzer';

const DEFAULT_BASE_URL = 'https://api.hrfco.go.kr';
const DAM_CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

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
  private damDataCache = new Map<string, { expires: number; data: any[] }>();

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

  private get apiKey(): string {
    const apiKey = this.config.apiKey ?? process.env.HRFCO_API_KEY;
    if (!apiKey) {
      throw new Error('홍수통제소 API 키 (HRFCO_API_KEY)가 필요합니다.');
    }
    return apiKey;
  }

  private buildApiUrl(endpoint: string, params: Record<string, string | number | undefined> = {}): string {
    const base = this.getBaseUrl().replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${base}/${this.apiKey}${path}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  private async requestXml(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    expects: 'text' | 'xml' = 'xml',
  ): Promise<any> {
    const url = this.buildApiUrl(endpoint, params);
    const controller = new AbortController();
    const timeoutMs = this.config.timeout ?? 10000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.debug('HRFCO XML request', {
        url,
        params: Object.keys(params),
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/xml',
          'User-Agent': 'HRFCO-MCP-Client/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HRFCO API 오류: ${response.status} ${response.statusText}`);
      }

      const raw = await response.text();

      if (expects === 'text') {
        return raw;
      }

      return await this.parseXmlResponse(raw);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('HRFCO API 요청 시간이 초과되었습니다.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseXmlResponse(xmlData: string): Promise<any> {
    try {
      return await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: false,
        trim: true,
        explicitRoot: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`XML parsing failed: ${message}`);
    }
  }

  private extractItems(parsed: any): any[] {
    if (!parsed) return [];

    const candidates = [
      parsed?.response?.body?.items?.item,
      parsed?.body?.items?.item,
      parsed?.items?.item,
      parsed?.content?.item,
      parsed?.list?.item,
      parsed?.item,
    ];

    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue;
      if (Array.isArray(candidate)) return candidate;
      return [candidate];
    }

    if (parsed?.content) {
      const content = parsed.content;
      if (Array.isArray(content)) {
        return content.flatMap((entry: any) => this.extractItems(entry));
      }

      if (typeof content === 'object') {
        const values = Object.values(content)
          .flatMap(value => (Array.isArray(value) ? value : [value]))
          .filter(Boolean);
        if (values.length > 0) {
          return values as any[];
        }
      }
    }

    if (Array.isArray(parsed)) return parsed;

    return [];
  }

  async getObservatories(hydroType: StationType = 'waterlevel'): Promise<Observatory[]> {
    const parsed = await this.requestXml(`/${hydroType}/info.xml`);
    const records = this.extractItems(parsed);

    return records
      .map(item => this.normalizeObservatoryRecord(item, hydroType))
      .filter((obs): obs is Observatory => Boolean(obs?.obs_code && obs?.obs_name));
  }

  async getRainfallStations(): Promise<Observatory[]> {
    return this.getObservatories('rainfall');
  }

  async getStationList(endpoint: string): Promise<any[]> {
    const normalized = endpoint.replace(/^\//, '');
    const [hydroType, resource, timeTypeRaw] = normalized.split('/');

    if (!hydroType) {
      this.logger.warn('Unknown station list endpoint pattern', { endpoint });
      return [];
    }

    let xmlPath: string | null = null;

    if (resource?.startsWith('info')) {
      xmlPath = `/${hydroType}/info.xml`;
    } else if (resource?.startsWith('list')) {
      const timeType = (timeTypeRaw?.split('.')?.[0] ?? '10M').toUpperCase();
      xmlPath = `/${hydroType}/list/${timeType}.xml`;
    }

    if (!xmlPath) {
      this.logger.warn('Unsupported station list resource', { endpoint });
      return [];
    }

    const parsed = await this.requestXml(xmlPath);
    return this.extractItems(parsed);
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
    useCache = true,
  ): Promise<any[]> {
    const now = Date.now();
    const bucket = Math.floor(now / DAM_CACHE_TTL);
    const cacheKey = `${obsCode}_${bucket}`;

    if (!snapshots && useCache) {
      const cached = this.damDataCache.get(cacheKey);
      if (cached && cached.expires > now) {
        return cached.data;
      }
    }

    const damSnapshots = snapshots ?? (await this.fetchDamSnapshots());
    const result = this.resolveDamRecord(damSnapshots, [obsCode]);

    if (!result) {
      throw new Error(`댐 ${obsCode}의 데이터를 찾을 수 없습니다`);
    }

    const data = [result.data];

    if (!snapshots && useCache) {
      this.damDataCache.set(cacheKey, {
        expires: bucket * DAM_CACHE_TTL + DAM_CACHE_TTL,
        data,
      });
    }

    return data;
  }

  async getDamTimeSeries(timeType: '10M' | '1H' | '1D' = '1H'): Promise<any[]> {
    const parsed = await this.requestXml(`/dam/list/${timeType}.xml`);
    const items = this.extractItems(parsed);
    return items.map(item => this.normalizeDamSeriesRecord(item)).filter(Boolean);
  }

  async getDamTimeSeriesFiltered(
    damCode: string,
    timeType: '10M' | '1H' | '1D' = '1H',
  ): Promise<any[]> {
    const series = await this.getDamTimeSeries(timeType);
    return series.filter(item => item.obsCode === damCode);
  }

  async getWaterLevelTimeSeries(
    stationCode: string,
    timeType: '10M' | '1H' | '1D' = '1H',
  ): Promise<any[]> {
    const parsed = await this.requestXml(`/waterlevel/list/${timeType}.xml`);
    const items = this.extractItems(parsed);
    return items
      .map(item => this.normalizeWaterLevelSeriesRecord(item))
      .filter(entry => entry.obsCode === stationCode);
  }

  async getRainfallTimeSeries(
    stationCode: string,
    timeType: '10M' | '1H' | '1D' = '1H',
  ): Promise<any[]> {
    const parsed = await this.requestXml(`/rainfall/list/${timeType}.xml`);
    const items = this.extractItems(parsed);
    return items
      .map(item => this.normalizeRainfallSeriesRecord(item))
      .filter(entry => entry.obsCode === stationCode);
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

      const quickMode = this.isQuickQuery(query);

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
            return await this.createIntegratedDamResponse(
              query,
              damResult?.code ?? waterResult?.code ?? '',
              waterResult?.code ?? damResult?.code ?? '',
              damResult?.data ?? null,
              waterResult?.data ?? null,
              { quickMode },
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
            return await this.createIntegratedDamResponse(
              station.name,
              damResult?.code ?? station.code,
              waterResult?.code ?? damResult?.code ?? station.code,
              damResult?.data ?? null,
              waterResult?.data ?? null,
              { quickMode },
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

  private convertDMSToDecimal(dmsString?: string): number {
    if (!dmsString || dmsString.trim() === '') return 0;
    const parts = dmsString.trim().split('-').map(part => parseFloat(part.trim()));
    if (parts.length !== 3 || parts.some(part => Number.isNaN(part))) return 0;
    const [degrees, minutes, seconds] = parts;
    return degrees + minutes / 60 + seconds / 3600;
  }

  private normalizeObservatoryRecord(item: any, hydroType: StationType): Observatory | null {
    if (!item) return null;

    const obsCode =
      item.wlobscd ??
      item.wlObsCd ??
      item.rfobscd ??
      item.rfObsCd ??
      item.dmobscd ??
      item.damObsCd ??
      item.obsCode ??
      '';

    const name =
      item.obsnm ??
      item.obsNm ??
      item.rfobsnm ??
      item.rfObsNm ??
      item.damnm ??
      item.damNm ??
      item.obsname ??
      item.obsName ??
      '';

    if (!obsCode || !name) return null;

    const toNumber = (value: any) => {
      const parsed = this.safeParseNumber(value);
      return parsed === null ? undefined : parsed;
    };

    const warningLevelsRaw =
      item.attwl ||
      item.wrnwl ||
      item.almwl ||
      item.srswl ||
      item.pfh
        ? {
            attention: toNumber(item.attwl ?? item.attention),
            warning: toNumber(item.wrnwl ?? item.warning),
            alarm: toNumber(item.almwl ?? item.alarm),
            serious: toNumber(item.srswl ?? item.serious),
            flood_control: toNumber(item.pfh ?? item.floodControl),
          }
        : undefined;

    const warningLevels =
      warningLevelsRaw && Object.values(warningLevelsRaw).some(value => value !== undefined)
        ? warningLevelsRaw
        : undefined;

    return {
      obs_code: obsCode,
      obs_name: name,
      river_name: item.river_name || item.riverName,
      location: item.addr || item.address || item.location,
      latitude: toNumber(item.lat ?? item.latitude),
      longitude: toNumber(item.lon ?? item.longitude),
      agency: item.agcnm || item.agcNm || item.agency,
      ground_level: toNumber(item.gdt ?? item.groundLevel),
      warning_levels: warningLevels,
      hydro_type: hydroType,
    };
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

  private async createIntegratedDamResponse(
    damName: string,
    damCode: string,
    waterLevelCode: string,
    damData: any,
    waterLevelData: any,
    options: { quickMode?: boolean } = {},
  ): Promise<IntegratedResponse> {
    const { quickMode = false } = options;
    const primaryData = damData ?? waterLevelData ?? null;
    const waterLevelValue = Number.isFinite(primaryData?.water_level)
      ? primaryData.water_level
      : null;
    const inflowValue = Number.isFinite(damData?.inflow) ? damData.inflow : null;
    const outflowValue = Number.isFinite(damData?.outflow) ? damData.outflow : null;
    const currentStorageValue = Number.isFinite(damData?.current_storage)
      ? damData.current_storage
      : null;
    const observationTime =
      typeof primaryData?.obs_time === 'string' ? primaryData.obs_time : '';

    const currentLevel = waterLevelValue !== null ? `${waterLevelValue.toFixed(1)}m` : '정보 없음';
    const status = waterLevelValue !== null ? this.determineStatus(waterLevelValue) : '정보 없음';
    const trend = waterLevelValue !== null ? this.determineTrend(waterLevelValue) : '정보 없음';
    const lastUpdated = this.parseObsTime(observationTime);
    const formattedTimestamp = this.formatToKoreanTime(observationTime);

    const storageRateValue =
      currentStorageValue !== null ? calculateStorageRate(currentStorageValue, damCode) : null;
    const damCapacity = getDamCapacityInfo(damCode);
    const relatedDamEntries = getWatershedDams(damCode);
    const relatedStations = relatedDamEntries.map(dam => ({ name: dam.name, code: dam.code }));
    const relatedDamNames = relatedDamEntries.map(dam => dam.name);
    const watershedLabel = damCapacity?.watershed ?? '동일 수계';

    const damInfo: PrimaryStation = {
      name: damName,
      code: damCode,
      current_level: currentLevel,
      status,
      trend,
      last_updated: lastUpdated,
    };

    if (inflowValue !== null) {
      damInfo.inflow = `${inflowValue.toFixed(1)}m³/s`;
    }
    if (outflowValue !== null) {
      damInfo.outflow = `${outflowValue.toFixed(1)}m³/s`;
    }
    if (currentStorageValue !== null) {
      damInfo.current_storage = `${currentStorageValue.toFixed(1)}백만㎥`;
    }
    if (storageRateValue !== null) {
      damInfo.storage_rate = `${storageRateValue}%`;
    }
    if (damCapacity) {
      const formattedCapacity = this.formatCapacity(damCapacity.totalCapacity);
      if (formattedCapacity) {
        damInfo.total_storage = `${formattedCapacity}백만㎥`;
      }
    }
    if (damData?.water_level_analysis) {
      damInfo.water_level_analysis = damData.water_level_analysis;
      damInfo.flood_limit_level = `${damData.flood_limit_level}m`;
    }

    const waterLevelInfo: WaterLevelStation | undefined = waterLevelData
      ? {
          name: `${damName} 수위관측소`,
          code: waterLevelCode,
          current_level: Number.isFinite(waterLevelData.water_level)
            ? `${waterLevelData.water_level.toFixed(1)}m`
            : '정보 없음',
          last_updated: this.parseObsTime(waterLevelData.obs_time),
        }
      : undefined;

    const summaryParts: string[] = [];
    if (outflowValue !== null) {
      summaryParts.push(`방류량 ${outflowValue.toFixed(1)}m³/s`);
    }
    if (storageRateValue !== null) {
      summaryParts.push(`저수율 ${storageRateValue}%`);
    }
    const summary =
      summaryParts.length > 0
        ? `${damName} ${summaryParts.join(', ')}`
        : `${damName} 현재 수위는 ${currentLevel}입니다`;

    const isoTimestamp = this.obsTimeToISOString(observationTime) ?? new Date().toISOString();

    const directAnswer = quickMode
      ? this.formatQuickResponse({
          damName,
          waterLevel: waterLevelValue,
          outflow: outflowValue,
          inflow: inflowValue,
          storageRate: storageRateValue,
          currentStorage: currentStorageValue,
          observationTime,
        })
      : await this.buildDamNarrative({
          damName,
          damCode,
          waterLevel: waterLevelValue,
          inflowRate: inflowValue,
          outflowRate: outflowValue,
          currentStorage: currentStorageValue,
          storageRate: storageRateValue,
          observationTime,
          relatedDamNames,
          watershedLabel,
        });

    const fallbackRelated = this.getRelatedStations(damName, damCode);
    const combinedRelated =
      relatedStations.length > 0
        ? relatedStations
        : fallbackRelated;

    return {
      status: 'success',
      summary,
      direct_answer: directAnswer,
      detailed_data: {
        type: 'dam',
        primary_station: damInfo,
        water_level_station: waterLevelInfo,
        related_stations: combinedRelated,
      },
      timestamp: isoTimestamp,
    };
  }

  private async getComprehensiveAnalysis(damCode: string) {
    const [realtimeRaw, hourlyRaw, dailyRaw] = await Promise.all([
      this.getDamTimeSeriesFiltered(damCode, '10M'),
      this.getDamTimeSeriesFiltered(damCode, '1H'),
      this.getDamTimeSeriesFiltered(damCode, '1D'),
    ]);

    const realtime = this.normalizeDamTimeSeries(realtimeRaw).slice(0, 36);
    const hourly = this.normalizeDamTimeSeries(hourlyRaw).slice(0, 24);
    const daily = this.normalizeDamTimeSeries(dailyRaw).slice(0, 30);

    const shortTermTrend = TimeSeriesAnalyzer.analyzeTrend(realtime, 'swl').direction;
    const mediumTermTrend = TimeSeriesAnalyzer.analyzeTrend(hourly, 'swl').direction;
    const longTermTrend = TimeSeriesAnalyzer.analyzeTrend(daily, 'swl').direction;

    return {
      realtime,
      hourly,
      daily,
      trends: {
        shortTerm: shortTermTrend,
        mediumTerm: mediumTermTrend,
        longTerm: longTermTrend,
      },
    };
  }

  private async buildDamNarrative({
    damName,
    damCode,
    waterLevel,
    inflowRate,
    outflowRate,
    currentStorage,
    storageRate,
    observationTime,
    relatedDamNames,
    watershedLabel,
  }: {
    damName: string;
    damCode: string;
    waterLevel: number | null;
    inflowRate: number | null;
    outflowRate: number | null;
    currentStorage: number | null;
    storageRate: number | null;
    observationTime?: string;
    relatedDamNames?: string[];
    watershedLabel: string;
  }): Promise<string> {
    const snapshot = this.formatDamSnapshot({
      damName,
      damCode,
      waterLevel,
      inflowRate,
      outflowRate,
      currentStorage,
      storageRate,
      observationTime,
      relatedDamNames,
      watershedLabel,
    });

    try {
      const analysis = await this.getComprehensiveAnalysis(damCode);
      const realtimeSeries = analysis.realtime;
      const hourlySeries = analysis.hourly;
      const dailySeries = analysis.daily;

      const storageRateValue =
        storageRate !== null
          ? storageRate
          : currentStorage !== null
            ? calculateStorageRate(currentStorage, damCode)
            : null;

      const storageBar = this.buildStorageBar(storageRateValue);
      const formattedTime = this.formatToKoreanTime(observationTime);
      const watershedRelated = relatedDamNames && relatedDamNames.length > 0
        ? relatedDamNames.join(', ')
        : '정보 없음';

      const realtimeTrend = TimeSeriesAnalyzer.analyzeTrend(realtimeSeries, 'swl');
      const dischargeTrend = TimeSeriesAnalyzer.analyzeTrend(realtimeSeries, 'otf');
      const inflowTrend = TimeSeriesAnalyzer.analyzeTrend(realtimeSeries, 'inf');

      const realtimeAverageOutflow = this.calculateAverage(realtimeSeries, 'otf');
      const hourlyMaxOutflow = this.findMax(hourlySeries, 'otf');
      const dailyAverageStorage = this.calculateAverage(dailySeries, 'fwVol');

      const shortTermTrend = analysis.trends.shortTerm;
      const mediumTermTrend = analysis.trends.mediumTerm;
      const longTermTrend = analysis.trends.longTerm;

      const recommendation = this.generateRecommendation(
        storageRateValue,
        analysis.trends,
      );

      return [
        `🌊 **${damName} 종합 분석**`,
        '',
        '📊 **현재 상황 (실시간)**',
        storageRateValue !== null
          ? `저수율: ${storageBar} ${storageRateValue}%`
          : '저수율: 정보 없음',
        `수위: ${this.formatMaybeNumber(waterLevel, 'm')}`,
        `방류량: ${this.formatMaybeNumber(outflowRate, ' m³/s')}`,
        `유입량: ${this.formatMaybeNumber(inflowRate, ' m³/s')}`,
        '',
        '📈 **시계열 분석**',
        `단기 추세 (6시간): ${shortTermTrend} ${this.getTrendEmoji(shortTermTrend)}`,
        `중기 추세 (24시간): ${mediumTermTrend} ${this.getTrendEmoji(mediumTermTrend)}`,
        `장기 추세 (30일): ${longTermTrend} ${this.getTrendEmoji(longTermTrend)}`,
        '',
        '📋 **운영 패턴**',
        `6시간 평균 방류량: ${this.formatMaybeNumber(realtimeAverageOutflow, ' m³/s', 2)}`,
        `24시간 최대 방류량: ${this.formatMaybeNumber(hourlyMaxOutflow, ' m³/s')}`,
        dailyAverageStorage !== null
          ? `30일 평균 저수량: ${this.formatMaybeNumber(dailyAverageStorage, ' 백만㎥', 1)}`
          : '30일 평균 저수량: 데이터 없음',
        '',
        '💡 **전문가 해석**',
        `운영 상태: ${this.interpretOperationStatus({
          realtimeTrend,
          dischargeTrend,
          inflowTrend,
          storageRate: storageRateValue,
        })}`,
        `향후 전망: ${this.generateForecast({
          shortTerm: shortTermTrend,
          mediumTerm: mediumTermTrend,
          longTerm: longTermTrend,
        })}`,
        `권고사항: ${recommendation}`,
        '',
        `🏞️ **${watershedLabel} 주요 댐**: ${watershedRelated}`,
        '',
        '🕐 **분석 기준**: 실시간·1시간·1일 단위 통합 분석',
        '💡 **데이터 제공**: 홍수통제소',
      ].join('\n');
    } catch (error) {
      this.logger.warn('Dam time-series analysis failed', {
        damCode,
        error: error instanceof Error ? error.message : error,
      });
      return snapshot;
    }
  }

  private formatDamSnapshot({
    damName,
    damCode,
    waterLevel,
    inflowRate,
    outflowRate,
    currentStorage,
    storageRate,
    observationTime,
    relatedDamNames,
    watershedLabel,
  }: {
    damName: string;
    damCode: string;
    waterLevel: number | null;
    inflowRate: number | null;
    outflowRate: number | null;
    currentStorage: number | null;
    storageRate: number | null;
    observationTime?: string;
    relatedDamNames?: string[];
    watershedLabel: string;
  }): string {
    const normalizedStorageRate =
      storageRate !== null
        ? storageRate
        : currentStorage !== null
          ? calculateStorageRate(currentStorage, damCode)
          : null;
    const damCapacity = getDamCapacityInfo(damCode);
    const relatedDams =
      relatedDamNames && relatedDamNames.length > 0
        ? relatedDamNames
        : getWatershedDams(damCode).map(dam => dam.name);
    const koreanTime = this.formatToKoreanTime(observationTime);

    const metrics: string[] = [];
    if (waterLevel !== null) {
      metrics.push(`- 현재 수위: ${waterLevel.toFixed(1)}m`);
    }
    if (outflowRate !== null) {
      metrics.push(`- 방류량: ${outflowRate.toFixed(1)} m³/s`);
    }
    if (inflowRate !== null) {
      metrics.push(`- 유입량: ${inflowRate.toFixed(1)} m³/s`);
    }
    if (currentStorage !== null) {
      metrics.push(`- 현재 저수량: ${currentStorage.toFixed(1)} 백만㎥`);
    }
    if (normalizedStorageRate !== null) {
      metrics.push(`- 저수율: ${normalizedStorageRate}%`);
    }
    if (damCapacity) {
      const capacityText = this.formatCapacity(damCapacity.totalCapacity);
      if (capacityText) {
        metrics.push(`- 총저수용량: ${capacityText} 백만㎥`);
      }
    }

    const storageStatus = this.getStorageStatus(normalizedStorageRate);
    const relatedText = relatedDams.length > 0 ? relatedDams.join(', ') : '정보 없음';

    return [
      `🌊 **${damName} 종합 현황**`,
      '',
      '📊 **주요 지표**',
      metrics.length > 0 ? metrics.join('\n') : '- 데이터 없음',
      '',
      `📈 **저수 상태**: ${storageStatus}`,
      '',
      `🏞️ **${watershedLabel} 주요 댐**: ${relatedText}`,
      '',
      `🕐 **측정시각**: ${koreanTime}`,
      '💡 **데이터 제공**: 홍수통제소',
    ].join('\n');
  }

  private normalizeDamTimeSeries(data: any[]): any[] {
    if (!Array.isArray(data)) return [];

    return data
      .filter(Boolean)
      .sort((a, b) => this.parseTimestampNumber(b) - this.parseTimestampNumber(a));
  }

  private parseTimestampNumber(entry: any): number {
    const candidate =
      typeof entry?.ymdhm === 'string'
        ? entry.ymdhm
        : typeof entry?.obs_time === 'string'
          ? entry.obs_time
          : typeof entry?.obsYmdhm === 'string'
            ? entry.obsYmdhm
            : typeof entry?.timestamp === 'string'
              ? entry.timestamp
              : '';

    if (/^\d{12}$/.test(candidate)) {
      return Number.parseInt(candidate, 10);
    }

    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }

    return Number.NEGATIVE_INFINITY;
  }

  private safeParseNumber(value: any, fallback: number | null = null): number | null {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private buildStorageBar(storageRate: number | null): string {
    if (storageRate === null) return '정보 없음';
    const segments = Math.max(0, Math.min(10, Math.round(storageRate / 10)));
    return '🟦'.repeat(segments) + '⬜'.repeat(10 - segments);
  }

  private formatMaybeNumber(
    value: number | null | undefined,
    unit: string,
    fractionDigits = 1,
  ): string {
    if (!Number.isFinite(value)) return '정보 없음';
    return `${(value as number).toFixed(fractionDigits)}${unit}`;
  }

  private formatDelta(value: number | null, unit: string): string {
    if (!Number.isFinite(value)) return '데이터 없음';
    if (Math.abs(value as number) < 0.05) return '변화 없음';
    const signed = (value as number) > 0 ? '+' : '';
    return `${signed}${(value as number).toFixed(1)}${unit}`;
  }

  private getTrendEmoji(direction: '상승' | '하강' | '안정'): string {
    switch (direction) {
      case '상승':
        return '🔼';
      case '하강':
        return '🔽';
      default:
        return '➡️';
    }
  }

  private calculateAverage(data: any[], field: string): number | null {
    if (!Array.isArray(data) || data.length === 0) return null;
    const values = data
      .map(entry => this.safeParseNumber(entry?.[field]))
      .filter((value): value is number => value !== null);

    if (values.length === 0) return null;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  private findMax(data: any[], field: string): number | null {
    if (!Array.isArray(data) || data.length === 0) return null;
    const values = data
      .map(entry => this.safeParseNumber(entry?.[field]))
      .filter((value): value is number => value !== null);

    if (values.length === 0) return null;
    return Math.max(...values);
  }

  private interpretOperationStatus(context: {
    realtimeTrend: ReturnType<typeof TimeSeriesAnalyzer.analyzeTrend>;
    dischargeTrend: ReturnType<typeof TimeSeriesAnalyzer.analyzeTrend>;
    inflowTrend: ReturnType<typeof TimeSeriesAnalyzer.analyzeTrend>;
    storageRate: number | null;
  }): string {
    const { realtimeTrend, dischargeTrend, inflowTrend, storageRate } = context;

    if (storageRate !== null && storageRate >= 80) {
      return '💧 풍부 - 저수량이 충분하여 안정적인 운영이 가능합니다.';
    }
    if (storageRate !== null && storageRate < 30) {
      return '⚠️ 부족 - 저수율이 낮아 보수적인 방류 운영이 필요합니다.';
    }

    if (dischargeTrend.direction === '상승' && inflowTrend.direction !== '상승') {
      return '🔼 방류량 증가 - 하류 수위 조절 또는 예비방류 중입니다.';
    }

    if (realtimeTrend.direction === '하강' && dischargeTrend.direction === '상승') {
      return '✅ 수위 하강 - 방류를 통해 저수위 조절이 진행 중입니다.';
    }

    if (realtimeTrend.direction === '상승' && inflowTrend.direction === '상승') {
      return '🌧️ 유입량 증가 - 상류 강우 영향으로 수위 상승이 감지됩니다.';
    }

    return '➡️ 안정 - 급격한 변화 없이 정상 운영 중입니다.';
  }

  private generateForecast(trends: {
    shortTerm: '상승' | '하강' | '안정';
    mediumTerm: '상승' | '하강' | '안정';
    longTerm: '상승' | '하강' | '안정';
  }): string {
    const { shortTerm, mediumTerm, longTerm } = trends;

    if (shortTerm === '상승' && mediumTerm === '상승') {
      return '단기·중기 모두 상승세로 추가적인 수위 상승 가능성이 큽니다.';
    }

    if (shortTerm === '하강' && mediumTerm !== '상승') {
      return '단기적으로 하강세가 이어져 점진적인 수위 감소가 예상됩니다.';
    }

    if (longTerm === '상승') {
      return '30일 장기 추세가 상승 중이므로 계절적 상승 패턴에 주의하세요.';
    }

    if (longTerm === '하강' && shortTerm !== '상승') {
      return '장기적으로 하강 추세로 안정적인 저수 관리가 전망됩니다.';
    }

    return '큰 추세 변화 없이 현 상태가 유지될 가능성이 큽니다.';
  }

  private generateRecommendation(
    storageRate: number | null,
    trends: {
      shortTerm: '상승' | '하강' | '안정';
      mediumTerm: '상승' | '하강' | '안정';
      longTerm: '상승' | '하강' | '안정';
    },
  ): string {
    if (storageRate !== null && storageRate >= 90) {
      return '방류량 조정 계획과 시설 점검을 사전에 검토하세요.';
    }

    if (storageRate !== null && storageRate <= 25) {
      return '생활·농업 용수 확보를 위해 절수 대책 및 비상 공급 계획을 준비하세요.';
    }

    if (trends.shortTerm === '상승') {
      return '상류 강우 상황을 집중 모니터링하며 방류 계획을 유연하게 운영하세요.';
    }

    if (trends.mediumTerm === '하강' && trends.longTerm === '하강') {
      return '저수량 확보를 위해 필요 시 방류량을 추가로 축소할 여지가 있습니다.';
    }

    return '정기적인 시계열 분석으로 추세 변화를 지속적으로 관찰하세요.';
  }

  private formatQuickResponse({
    damName,
    waterLevel,
    outflow,
    inflow,
    storageRate,
    currentStorage,
    observationTime,
  }: {
    damName: string;
    waterLevel: number | null;
    outflow: number | null;
    inflow: number | null;
    storageRate: number | null;
    currentStorage: number | null;
    observationTime?: string;
  }): string {
    const outflowText = this.formatMaybeNumber(outflow, ' m³/s');
    const inflowText = this.formatMaybeNumber(inflow, ' m³/s');
    const waterLevelText = this.formatMaybeNumber(waterLevel, 'm');
    const storageRateText = storageRate !== null ? `${storageRate}%` : '정보 없음';
    const storageVolumeText = this.formatMaybeNumber(currentStorage, ' 백만㎥');
    const statusText = this.getStorageStatus(storageRate);
    const timeText = this.formatToKoreanTime(observationTime);

    return [
      `🌊 ${damName} 현재 현황`,
      '',
      '📊 실시간 데이터',
      '',
      `방류량: ${outflowText}`,
      `유입량: ${inflowText}`,
      `저수율: ${storageRateText}`,
      `수위: ${waterLevelText}`,
      `저수량: ${storageVolumeText}`,
      `상태: ${statusText}`,
      '',
      `🕐 측정시각: ${timeText}`,
      '💡 상세 분석이 필요하면 "자세히" 또는 "분석"이라고 요청하세요.',
    ].join('\n');
  }

  private isQuickQuery(rawQuery: string): boolean {
    if (!rawQuery) return false;
    const normalized = rawQuery.trim();
    if (!normalized) return false;

    const lower = normalized.toLowerCase();
    const avoidKeywords = ['분석', 'trend', '자세히', '상세', 'forecast', '패턴'];
    if (avoidKeywords.some(keyword => lower.includes(keyword))) {
      return false;
    }

    const quickKeywords = ['방류량', '수위', '현황', '몇', '얼마', '댐'];
    return quickKeywords.some(keyword => normalized.includes(keyword));
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

  private formatToKoreanTime(timestamp?: string): string {
    if (!timestamp) return '정보 없음';

    const trimmed = timestamp.trim();
    if (!trimmed) return '정보 없음';

    try {
      if (/^\d{12}$/.test(trimmed)) {
        const year = trimmed.substring(0, 4);
        const month = trimmed.substring(4, 6);
        const day = trimmed.substring(6, 8);
        const hour = trimmed.substring(8, 10);
        const minute = trimmed.substring(10, 12);
        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        }
      } else {
        const date = new Date(trimmed);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        }
      }
    } catch (error) {
      this.logger.warn('formatToKoreanTime failed', {
        timestamp,
        error: error instanceof Error ? error.message : error,
      });
    }

    return trimmed;
  }

  private obsTimeToISOString(timestamp?: string): string | null {
    if (!timestamp) return null;
    const trimmed = timestamp.trim();
    if (!trimmed) return null;

    if (/^\d{12}$/.test(trimmed)) {
      const year = trimmed.substring(0, 4);
      const month = trimmed.substring(4, 6);
      const day = trimmed.substring(6, 8);
      const hour = trimmed.substring(8, 10);
      const minute = trimmed.substring(10, 12);
      const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return null;
  }

  private getStorageStatus(storageRate: number | null): string {
    if (storageRate === null) return '정보 없음';
    if (storageRate >= 80) return '🟢 풍부 (80% 이상)';
    if (storageRate >= 60) return '🟡 보통 (60-79%)';
    if (storageRate >= 40) return '🟠 주의 (40-59%)';
    if (storageRate >= 20) return '🔴 부족 (20-39%)';
    return '🚨 심각 (20% 미만)';
  }

  private formatCapacity(value: number): string | null {
    if (!Number.isFinite(value)) return null;
    if (Number.isInteger(value)) {
      return value.toLocaleString('ko-KR');
    }
    return value.toLocaleString('ko-KR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  private parseObsTime(obsTime: string): string {
    const formatted = this.formatToKoreanTime(obsTime);
    if (!formatted || formatted === '정보 없음') {
      return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    }
    return formatted;
  }

  private getRelatedStations(
    stationName: string,
    stationCode?: string,
  ): Array<{ name: string; code: string; current_level?: string; status?: string }> {
    if (stationCode && DAM_CAPACITY_DATA[stationCode]) {
      return getWatershedDams(stationCode).map(dam => ({
        name: dam.name,
        code: dam.code,
      }));
    }

    const related: Array<{ name: string; code: string; current_level?: string; status?: string }> = [];

    if (stationName.includes('대교')) {
      related.push({ name: '한강대교', code: '1018683' });
    }

    return related;
  }

  private async fetchWaterLevelSnapshot(): Promise<WaterLevelRecord[]> {
    const parsed = await this.requestXml('/waterlevel/list/10M.xml');
    const items = this.extractItems(parsed);
    return items
      .map(item => this.normalizeWaterLevelRecord(item))
      .filter((record): record is WaterLevelRecord => Boolean(record));
  }

  private async fetchRainfallSnapshot(): Promise<RainfallRecord[]> {
    const parsed = await this.requestXml('/rainfall/list/10M.xml');
    const items = this.extractItems(parsed);
    return items
      .map(item => this.normalizeRainfallRecord(item))
      .filter((record): record is RainfallRecord => Boolean(record));
  }

  private async fetchDamSnapshots(): Promise<{
    realtime: DamRealtimeRecord[];
    info: DamInfoRecord[];
  }> {
    const [realtimeParsed, infoParsed] = await Promise.all([
      this.requestXml('/dam/list/10M.xml'),
      this.requestXml('/dam/info.xml'),
    ]);

    const realtimeItems = this.extractItems(realtimeParsed);
    const infoItems = this.extractItems(infoParsed);

    return {
      realtime: realtimeItems
        .map(item => this.normalizeDamRealtimeRecord(item))
        .filter((record): record is DamRealtimeRecord => Boolean(record)),
      info: infoItems
        .map(item => this.normalizeDamInfoRecord(item))
        .filter((record): record is DamInfoRecord => Boolean(record)),
    };
  }

  private normalizeDamRealtimeRecord(item: any): DamRealtimeRecord | null {
    if (!item) return null;
    const obsCode =
      item.dmobscd ??
      item.damObsCd ??
      item.obsCode ??
      item.obs_code ??
      item.obsCd ??
      '';
    if (!obsCode) return null;

    return {
      dmobscd: obsCode,
      swl: this.formatNumberString(item.swl ?? item.wl ?? item.waterLevel),
      inf: this.formatNumberString(item.inf ?? item.inflow),
      tototf: this.formatNumberString(item.tototf ?? item.otf ?? item.outflow),
      sfw: this.formatNumberString(item.sfw ?? item.fwvol ?? item.currentStorage),
      ecpc: this.formatNumberString(item.ecpc ?? item.effectiveStorage),
      ymdhm: this.normalizeTimestamp(item.ymdhm ?? item.obsYmdhm ?? item.obs_time ?? item.timestamp),
    };
  }

  private normalizeDamInfoRecord(item: any): DamInfoRecord | null {
    if (!item) return null;
    const obsCode =
      item.dmobscd ??
      item.damObsCd ??
      item.obsCode ??
      item.obs_code ??
      item.obsCd ??
      '';
    if (!obsCode) return null;

    return {
      dmobscd: obsCode,
      pfh: this.formatNumberString(item.pfh ?? item.floodControlCapacity),
      fldlmtwl: this.formatNumberString(item.fldlmtwl ?? item.floodLimitLevel),
    };
  }

  private normalizeWaterLevelRecord(item: any): WaterLevelRecord | null {
    if (!item) return null;
    const obsCode =
      item.wlobscd ??
      item.wlObsCd ??
      item.obsCode ??
      item.obs_code ??
      '';
    if (!obsCode) return null;

    return {
      wlobscd: obsCode,
      wl: this.formatNumberString(item.wl ?? item.swl ?? item.waterLevel),
      ymdhm: this.normalizeTimestamp(item.ymdhm ?? item.obsYmdhm ?? item.obs_time ?? item.timestamp),
    };
  }

  private normalizeRainfallRecord(item: any): RainfallRecord | null {
    if (!item) return null;
    const obsCode =
      item.rfobscd ??
      item.rfObsCd ??
      item.obsCode ??
      item.obs_code ??
      '';
    if (!obsCode) return null;

    return {
      rfobscd: obsCode,
      rf: this.formatNumberString(item.rf ?? item.rainfall ?? item.currentRainfall),
      ymdhm: this.normalizeTimestamp(item.ymdhm ?? item.obsYmdhm ?? item.obs_time ?? item.timestamp),
      obsnm: item.obsnm ?? item.obsName ?? item.rfobsnm ?? item.stationName,
      rfobsnm: item.rfobsnm ?? item.obsnm ?? item.stationName,
      rf_sum_1h: this.formatNumberString(item.rf_sum_1h ?? item.hourlyRainfall),
      rf_sum_24h: this.formatNumberString(item.rf_sum_24h ?? item.dailyRainfall),
    };
  }

  private normalizeDamSeriesRecord(item: any): any {
    if (!item) return null;
    const obsCode =
      item.dmobscd ??
      item.damObsCd ??
      item.obsCode ??
      item.obs_code ??
      '';
    if (!obsCode) return null;

    return {
      obsCode,
      swl: this.safeParseNumber(item.swl ?? item.wl ?? item.waterLevel) ?? 0,
      otf: this.safeParseNumber(item.tototf ?? item.otf ?? item.outflow) ?? 0,
      inf: this.safeParseNumber(item.inf ?? item.inflow) ?? 0,
      fwVol: this.safeParseNumber(item.sfw ?? item.fwvol ?? item.currentStorage),
      ymdhm: this.normalizeTimestamp(item.ymdhm ?? item.obsYmdhm ?? item.obs_time ?? item.timestamp),
    };
  }

  private normalizeWaterLevelSeriesRecord(item: any): any {
    if (!item) return null;
    const obsCode =
      item.wlobscd ??
      item.wlObsCd ??
      item.obsCode ??
      item.obs_code ??
      '';
    if (!obsCode) return null;

    return {
      obsCode,
      wl: this.safeParseNumber(item.wl ?? item.swl ?? item.waterLevel) ?? 0,
      ymdhm: this.normalizeTimestamp(item.ymdhm ?? item.obsYmdhm ?? item.obs_time ?? item.timestamp),
    };
  }

  private normalizeRainfallSeriesRecord(item: any): any {
    if (!item) return null;
    const obsCode =
      item.rfobscd ??
      item.rfObsCd ??
      item.obsCode ??
      item.obs_code ??
      '';
    if (!obsCode) return null;

    return {
      obsCode,
      rf: this.safeParseNumber(item.rf ?? item.rainfall ?? item.currentRainfall) ?? 0,
      ymdhm: this.normalizeTimestamp(item.ymdhm ?? item.obsYmdhm ?? item.obs_time ?? item.timestamp),
    };
  }

  private formatNumberString(value: any): string {
    const parsed = this.safeParseNumber(value);
    if (parsed === null) return '';
    return String(parsed);
  }

  private normalizeTimestamp(value: any): string | undefined {
    if (!value) return undefined;
    const trimmed = String(value).trim();
    if (trimmed === '') return undefined;
    if (/^\d{12}$/.test(trimmed)) return trimmed;

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear().toString().padStart(4, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hour = date.getHours().toString().padStart(2, '0');
      const minute = date.getMinutes().toString().padStart(2, '0');
      return `${year}${month}${day}${hour}${minute}`;
    }
    return trimmed;
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
