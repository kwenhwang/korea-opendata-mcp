type TrendDirection = '상승' | '하강' | '안정';

interface TrendAnalysis {
  direction: TrendDirection;
  change: number;
  percentage: number;
  description: string;
}

interface DailySummary {
  current: number;
  max: number;
  min: number;
  average: number;
  maxTime: string;
  minTime: string;
}

interface ChangeRates {
  vs1hour: number | null;
  vs6hours: number | null;
  vs24hours: number | null;
}

type ValueField = string | string[];

export class TimeSeriesAnalyzer {
  /**
   * 변화 추세 분석 (최근 데이터 기준)
   */
  static analyzeTrend(data: any[], valueField: ValueField): TrendAnalysis {
    if (!Array.isArray(data) || data.length < 2) {
      return {
        direction: '안정',
        change: 0,
        percentage: 0,
        description: '데이터 부족',
      };
    }

    const latest = this.extractValue(data[0], valueField);
    const previous = this.extractValue(data[1], valueField);

    if (!Number.isFinite(latest) || !Number.isFinite(previous)) {
      return {
        direction: '안정',
        change: 0,
        percentage: 0,
        description: '데이터 부족',
      };
    }

    const change = latest - previous;
    const percentage = previous !== 0 ? (change / previous) * 100 : 0;

    let direction: TrendDirection = '안정';
    let description = '변화 없음';

    if (Math.abs(change) >= 0.1) {
      if (change > 0) {
        direction = '상승';
        description = `${change.toFixed(1)} 증가`;
      } else {
        direction = '하강';
        description = `${Math.abs(change).toFixed(1)} 감소`;
      }
    }

    return {
      direction,
      change,
      percentage,
      description,
    };
  }

  /**
   * 24시간 요약 통계
   */
  static getDailySummary(data: any[], valueField: ValueField): DailySummary | null {
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const values = data
      .map(entry => this.extractValue(entry, valueField))
      .filter((value): value is number => Number.isFinite(value));

    if (values.length === 0) {
      return null;
    }

    const current = values[0];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;

    const maxIndex = values.indexOf(max);
    const minIndex = values.indexOf(min);
    const originalMaxEntry = data[maxIndex];
    const originalMinEntry = data[minIndex];

    return {
      current,
      max,
      min,
      average,
      maxTime: this.extractTimestamp(originalMaxEntry),
      minTime: this.extractTimestamp(originalMinEntry),
    };
  }

  /**
   * 변화율 계산 (1시간/6시간/24시간 전 대비)
   */
  static getChangeRates(data: any[], valueField: ValueField): ChangeRates {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        vs1hour: null,
        vs6hours: null,
        vs24hours: null,
      };
    }

    const current = this.extractValue(data[0], valueField);
    if (!Number.isFinite(current)) {
      return {
        vs1hour: null,
        vs6hours: null,
        vs24hours: null,
      };
    }

    const calc = (index: number): number | null => {
      if (data.length <= index) return null;
      const past = this.extractValue(data[index], valueField);
      if (!Number.isFinite(past)) return null;
      return current - past;
    };

    return {
      vs1hour: calc(1),
      vs6hours: calc(6),
      vs24hours: calc(23),
    };
  }

  private static extractValue(entry: any, field: ValueField): number {
    if (!entry) return NaN;
    const fields = Array.isArray(field) ? field : [field];

    for (const key of fields) {
      const raw = entry?.[key];
      if (raw === undefined || raw === null || raw === '') continue;
      const parsed = Number.parseFloat(String(raw));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return NaN;
  }

  private static extractTimestamp(entry: any): string {
    if (!entry) return '';
    if (typeof entry.ymdhm === 'string') return entry.ymdhm;
    if (typeof entry.obsTime === 'string') return entry.obsTime;
    if (typeof entry.timestamp === 'string') return entry.timestamp;
    return '';
  }
}
