import { XMLParser } from 'fast-xml-parser';

import type { Logger } from '../utils/logger';
import { logger as defaultLogger } from '../utils/logger';
import { BaseAPI } from './base/BaseAPI';
import { loadAPIConfig } from './base/config';
import type { APIConfig, AuthContext } from './base/types';
import { AuthStrategy } from './base/types';
import {
  REGION_CODES,
  type NormalizedTransaction,
  type RealEstateAPIResponse,
  type Transaction,
} from './types/realestate.types';

const DEFAULT_BASE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev';

export interface RealEstateConfig extends APIConfig {}

interface RegionMatch {
  code: string;
  label: string;
}

export class RealEstateAPI extends BaseAPI<RealEstateConfig, RealEstateAPIResponse> {
  private readonly xmlParser: XMLParser;

  constructor(overrides: Partial<RealEstateConfig> = {}, logger: Logger = defaultLogger) {
    const config = loadAPIConfig('RealEstate', {
      overrides: {
        baseUrl: DEFAULT_BASE_URL,
        authStrategy: AuthStrategy.ServiceKey,
        ...overrides,
      },
      logger,
    }) as RealEstateConfig;

    super(config, logger);

    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseTagValue: true,
      trimValues: true,
    });
  }

  protected getBaseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }

  protected authenticate(context: AuthContext): AuthContext {
    const serviceKey = this.config.serviceKey ?? this.config.apiKey;
    if (!serviceKey) {
      throw new Error('국토교통부 실거래가 서비스키가 설정되어 있지 않습니다. 환경변수를 확인해주세요.');
    }

    return {
      params: {
        ...context.params,
        serviceKey,
      },
      headers: context.headers,
    };
  }

  protected parseResponse(data: unknown): RealEstateAPIResponse {
    if (typeof data === 'string') {
      try {
        return this.xmlParser.parse<RealEstateAPIResponse>(data);
      } catch (error) {
        this.logger.error('Failed to parse real estate XML response', {
          error: error instanceof Error ? error.message : error,
        });
        throw new Error('부동산 거래 데이터 파싱에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    }

    if (data && typeof data === 'object') {
      return data as RealEstateAPIResponse;
    }

    throw new Error('부동산 거래 API에서 예상치 못한 응답 형식이 수신되었습니다.');
  }

  async parseXMLResponse(xmlData: string): Promise<Transaction[]> {
    try {
      const parsed = this.xmlParser.parse<RealEstateAPIResponse>(xmlData);
      return this.extractTransactions(parsed);
    } catch (error) {
      this.logger.error('Real estate XML parsing error', {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  async getTransactionsByRegion(
    regionIdentifier: string,
    yearMonth: string,
    options: { pageNo?: number; numOfRows?: number } = {},
  ): Promise<NormalizedTransaction[]> {
    const region = this.ensureRegion(regionIdentifier);
    return this.fetchRegionTransactions(region, yearMonth, options);
  }

  async searchByApartment(
    apartmentName: string,
    regionIdentifier: string,
    yearMonth: string,
  ): Promise<NormalizedTransaction[]> {
    const region = this.ensureRegion(regionIdentifier);
    const keyword = apartmentName.trim();
    if (!keyword) {
      throw new Error('검색할 아파트명을 입력해주세요.');
    }

    const transactions = await this.fetchRegionTransactions(region, yearMonth, { numOfRows: 1000 });
    return this.filterTransactionsByApartment(transactions, keyword);
  }

  async searchAcrossRegions(
    apartmentName: string,
    yearMonth: string,
  ): Promise<NormalizedTransaction[]> {
    const keyword = apartmentName.trim();
    if (!keyword) {
      return [];
    }

    const aggregated: NormalizedTransaction[] = [];
    for (const [label, code] of Object.entries(REGION_CODES)) {
      const region = { code, label };
      try {
        const matches = await this.fetchRegionTransactions(region, yearMonth, { numOfRows: 300 });
        const filtered = this.filterTransactionsByApartment(matches, keyword);
        aggregated.push(...filtered);
      } catch (error) {
        this.logger.warn('Region search failed', {
          region: label,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const deduped = new Map<string, NormalizedTransaction>();
    aggregated.forEach(tx => {
      deduped.set(tx.transactionId, tx);
    });

    return Array.from(deduped.values()).sort((a, b) => {
      const dateCompare = b.dealDate.localeCompare(a.dealDate);
      if (dateCompare !== 0) return dateCompare;
      return b.priceWon - a.priceWon;
    });
  }

  resolveRegionCode(query: string): RegionMatch | null {
    const trimmed = query?.trim();
    if (!trimmed) return null;

    const normalized = this.normalizeText(trimmed);

    for (const [label, code] of Object.entries(REGION_CODES)) {
      const normalizedLabel = this.normalizeText(label.replace(/_/g, ' '));
      if (normalizedLabel === normalized) {
        return { code, label };
      }

      const labelParts = label.split('_').map(part => this.normalizeText(part));
      if (labelParts.some(part => part && (normalized.includes(part) || part.includes(normalized)))) {
        return { code, label };
      }

      if (normalized === code) {
        return { code, label };
      }
    }

    if (/^\d{5}$/.test(normalized)) {
      return {
        code: normalized,
        label: this.getRegionLabelByCode(normalized) ?? normalized,
      };
    }

    return null;
  }

  private fetchRegionTransactions(
    region: RegionMatch,
    yearMonth: string,
    options: { pageNo?: number; numOfRows?: number },
  ): Promise<NormalizedTransaction[]> {
    const pageNo = options.pageNo ?? 1;
    const numOfRows = options.numOfRows ?? 100;

    return this.request({
      endpoint: 'getRTMSDataSvcAptTradeDev',
      params: {
        LAWD_CD: region.code,
        DEAL_YMD: yearMonth,
        pageNo,
        numOfRows,
      },
      expects: 'xml',
    })
      .then(response => {
        const transactions = this.extractTransactions(response);
        if (transactions.length === 0) {
          this.logger.info('No real estate transactions for query', {
            region: region.label,
            regionCode: region.code,
            yearMonth,
          });
          return [];
        }
        return this.normalizeTransactions(transactions, region);
      })
      .catch(error => {
        if (error instanceof Error && /429/.test(error.message)) {
          throw new Error('부동산 실거래가 API 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해주세요.');
        }
        throw error;
      });
  }

  private filterTransactionsByApartment(
    transactions: NormalizedTransaction[],
    keyword: string,
  ): NormalizedTransaction[] {
    const normalizedKeyword = this.normalizeText(keyword);
    if (!normalizedKeyword) return transactions;

    return transactions.filter(item =>
      this.normalizeText(item.apartmentName).includes(normalizedKeyword),
    );
  }

  private extractTransactions(response: RealEstateAPIResponse): Transaction[] {
    const header = response.response?.header;
    const resultCode = header?.resultCode?.trim();
    const resultMsg = header?.resultMsg;

    if (resultCode && resultCode !== '00') {
      if (resultCode === '03') {
        return [];
      }
      throw new Error(resultMsg || '부동산 실거래가 API 호출에 실패했습니다.');
    }

    const items = response.response?.body?.items?.item;
    if (!items) {
      return [];
    }

    const transactions = Array.isArray(items) ? items : [items];
    return transactions.filter((item): item is Transaction => Boolean(item));
  }

  private normalizeTransactions(
    transactions: Transaction[],
    region: RegionMatch,
  ): NormalizedTransaction[] {
    const valid = transactions.filter(tx => tx.해제여부 !== 'O');

    const normalized = valid.map(tx => {
      const priceTenThousand = this.parseIntStrict(tx.거래금액);
      const priceWon = priceTenThousand * 10000;
      const areaSqmRaw = this.parseFloatSafe(tx.전용면적);
      const areaSquareMeter = Number.parseFloat(areaSqmRaw.toFixed(2));
      const areaPyeong = areaSquareMeter > 0
        ? Number.parseFloat((areaSquareMeter / 3.3058).toFixed(2))
        : 0;

      return {
        transactionId: tx.일련번호,
        regionCode: region.code,
        regionLabel: region.label,
        apartmentName: tx.아파트,
        dealDate: this.composeDate(tx.년, tx.월, tx.일),
        dealType: tx.거래유형 || undefined,
        priceTenThousandWon: priceTenThousand,
        priceWon,
        areaSquareMeter,
        areaPyeong,
        floor: this.parseIntNullable(tx.층),
        constructionYear: this.parseIntNullable(tx.건축년도),
        raw: tx,
      };
    });

    return normalized.sort((a, b) => {
      const dateCompare = b.dealDate.localeCompare(a.dealDate);
      if (dateCompare !== 0) return dateCompare;
      return b.priceWon - a.priceWon;
    });
  }

  private ensureRegion(regionIdentifier: string): RegionMatch {
    const match = this.resolveRegionCode(regionIdentifier);
    if (match) {
      return match;
    }

    throw new Error(
      `지원하지 않는 지역이나 코드입니다: ${regionIdentifier}. 예) 서울_강남구 또는 11680 형식으로 입력해주세요.`,
    );
  }

  private getRegionLabelByCode(code: string): string | null {
    const entry = Object.entries(REGION_CODES).find(([, value]) => value === code);
    return entry ? entry[0] : null;
  }

  private composeDate(year: string, month: string, day: string): string {
    const y = year.padStart(4, '0');
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseIntStrict(value: string): number {
    const numeric = value?.replace(/[^0-9-]/g, '');
    if (!numeric) {
      return 0;
    }
    const parsed = Number.parseInt(numeric, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private parseIntNullable(value: string): number | null {
    const numeric = value?.replace(/[^0-9-]/g, '');
    if (!numeric) {
      return null;
    }
    const parsed = Number.parseInt(numeric, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private parseFloatSafe(value: string): number {
    const cleaned = value?.replace(/[^0-9.]/g, '');
    if (!cleaned) {
      return 0;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private normalizeText(value: string): string {
    return value
      .toString()
      .toLowerCase()
      .replace(/[\s_]/g, '')
      .trim();
  }
}
