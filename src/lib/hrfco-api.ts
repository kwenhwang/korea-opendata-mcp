import type { Logger } from '../utils/logger';
import { logger as defaultLogger } from '../utils/logger';
import { FloodControlAPI, type FloodControlConfig } from '../apis/FloodControlAPI';

export class HRFCOAPIClient {
  private readonly api: FloodControlAPI;

  constructor(apiKey?: string, logger: Logger = defaultLogger) {
    const overrides: Partial<FloodControlConfig> = {};
    if (apiKey) {
      overrides.apiKey = apiKey;
    }

    this.api = new FloodControlAPI(overrides, logger);
  }

  async getObservatories(hydroType?: string) {
    return this.api.getObservatories(hydroType);
  }

  async getStationList(endpoint: string) {
    return this.api.getStationList(endpoint);
  }

  async getWaterLevelData(obsCode: string, timeType?: string) {
    return this.api.getWaterLevelData(obsCode, timeType);
  }

  async getRainfallData(obsCode: string, timeType?: string) {
    return this.api.getRainfallData(obsCode, timeType);
  }

  async getDamData(obsCode: string) {
    return this.api.getDamData(obsCode);
  }

  searchObservatory(query: string, observatories: any[]) {
    return this.api.searchObservatory(query, observatories);
  }

  async searchAndGetData(query: string) {
    return this.api.searchAndGetData(query);
  }
}

