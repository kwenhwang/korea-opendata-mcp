import type { Logger } from '../utils/logger';
import { logger as defaultLogger } from '../utils/logger';
import { FloodControlAPI, type FloodControlConfig } from '../apis/FloodControlAPI';
import { RealEstateAPI, type RealEstateConfig } from '../apis/RealEstateAPI';
import type { NormalizedTransaction } from '../apis/types/realestate.types';

export interface KoreaOpenDataClientOptions {
  floodControlApiKey?: string;
  realEstateServiceKey?: string;
}

export interface RealEstateRegion {
  code: string;
  label: string;
}

export interface RealEstateSearchResult {
  status: 'success' | 'error';
  query: string;
  yearMonth: string;
  region?: RealEstateRegion;
  apartmentFilter?: string;
  transactions: NormalizedTransaction[];
  message?: string;
}

type ConstructorParam = string | KoreaOpenDataClientOptions | undefined;

export class KoreaOpenDataAPIClient {
  private readonly floodControlApi: FloodControlAPI;
  private readonly realEstateApi: RealEstateAPI;
  private readonly logger: Logger;

  constructor(param?: ConstructorParam, logger: Logger = defaultLogger) {
    this.logger = logger;

    const floodControlOverrides: Partial<FloodControlConfig> = {};
    const realEstateOverrides: Partial<RealEstateConfig> = {};

    if (typeof param === 'string') {
      floodControlOverrides.apiKey = param;
    } else if (param) {
      if (param.floodControlApiKey) {
        floodControlOverrides.apiKey = param.floodControlApiKey;
      }
      if (param.realEstateServiceKey) {
        realEstateOverrides.serviceKey = param.realEstateServiceKey;
      }
    }

    this.floodControlApi = new FloodControlAPI(floodControlOverrides, logger);
    this.realEstateApi = new RealEstateAPI(realEstateOverrides, logger);
  }

  // Flood control endpoints -------------------------------------------------

  async getObservatories(hydroType?: string) {
    return this.floodControlApi.getObservatories(hydroType);
  }

  async getStationList(endpoint: string) {
    return this.floodControlApi.getStationList(endpoint);
  }

  async getWaterLevelData(obsCode: string, timeType?: string) {
    return this.floodControlApi.getWaterLevelData(obsCode, timeType);
  }

  async getRainfallData(obsCode: string, timeType?: string) {
    return this.floodControlApi.getRainfallData(obsCode, timeType);
  }

  async getDamData(obsCode: string) {
    return this.floodControlApi.getDamData(obsCode);
  }

  searchObservatory(query: string, observatories: any[]) {
    return this.floodControlApi.searchObservatory(query, observatories);
  }

  async searchAndGetData(query: string) {
    return this.floodControlApi.searchAndGetData(query);
  }

  // Real estate endpoints ---------------------------------------------------

  async getRealEstateInfo(query: string, yearMonth?: string): Promise<RealEstateSearchResult> {
    const sanitizedQuery = query?.trim() ?? '';
    const normalizedYearMonth = this.normalizeYearMonth(yearMonth);

    if (!sanitizedQuery) {
      return {
        status: 'error',
        query: sanitizedQuery,
        yearMonth: normalizedYearMonth,
        transactions: [],
        message: '검색어를 입력해주세요.',
      };
    }

    try {
      const region = this.realEstateApi.resolveRegionCode(sanitizedQuery);

      if (region) {
        const apartmentFilter = this.extractApartmentFilter(sanitizedQuery, region);
        let transactions = await this.realEstateApi.getTransactionsByRegion(
          region.code,
          normalizedYearMonth,
        );

        if (apartmentFilter) {
          const filtered = this.filterTransactions(transactions, apartmentFilter);
          if (filtered.length > 0) {
            transactions = filtered;
          } else {
            transactions = await this.realEstateApi.searchByApartment(
              apartmentFilter,
              region.code,
              normalizedYearMonth,
            );
          }
        }

        const hasData = transactions.length > 0;
        return {
          status: hasData ? 'success' : 'error',
          query: sanitizedQuery,
          yearMonth: normalizedYearMonth,
          region,
          apartmentFilter: apartmentFilter || undefined,
          transactions,
          message: hasData
            ? undefined
            : '해당 기간에 거래 데이터가 없습니다. 기간을 변경하거나 다른 지역을 시도해보세요.',
        };
      }

      const crossRegionResults = await this.realEstateApi.searchAcrossRegions(
        sanitizedQuery,
        normalizedYearMonth,
      );

      if (crossRegionResults.length === 0) {
        return {
          status: 'error',
          query: sanitizedQuery,
          yearMonth: normalizedYearMonth,
          transactions: [],
          message: '검색어에 해당하는 거래 정보를 찾지 못했습니다. 지역명을 함께 입력해보세요.',
        };
      }

      return {
        status: 'success',
        query: sanitizedQuery,
        yearMonth: normalizedYearMonth,
        transactions: crossRegionResults,
        message: '여러 지역에서 검색 결과를 찾았습니다. 상위 결과만 표시합니다.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      this.logger.error('Real estate lookup failed', { message });
      return {
        status: 'error',
        query: sanitizedQuery,
        yearMonth: normalizedYearMonth,
        transactions: [],
        message,
      };
    }
  }

  // -------------------------------------------------------------------------

  private normalizeYearMonth(yearMonth?: string): string {
    if (yearMonth && /^\d{6}$/.test(yearMonth)) {
      return yearMonth;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}${month}`;
  }

  private extractApartmentFilter(query: string, region: RealEstateRegion): string {
    let remaining = query;
    const tokens = new Set<string>();
    tokens.add(region.label);
    tokens.add(region.label.replace(/_/g, ' '));
    tokens.add(region.label.replace(/_/g, ''));
    region.label.split('_').forEach(part => tokens.add(part));
    tokens.add(region.code);

    tokens.forEach(token => {
      if (!token) return;
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'gi');
      remaining = remaining.replace(pattern, ' ');
    });

    return remaining.replace(/\s+/g, ' ').trim();
  }

  private filterTransactions(
    transactions: NormalizedTransaction[],
    keyword: string,
  ): NormalizedTransaction[] {
    const normalizedKeyword = this.normalizeText(keyword);
    if (!normalizedKeyword) return transactions;

    return transactions.filter(transaction =>
      this.normalizeText(transaction.apartmentName).includes(normalizedKeyword),
    );
  }

  private normalizeText(value: string): string {
    return value
      .toString()
      .toLowerCase()
      .replace(/[\s_]/g, '')
      .trim();
  }
}

