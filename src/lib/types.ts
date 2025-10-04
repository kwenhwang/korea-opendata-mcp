import { z } from 'zod';

export {
  ObservatorySchema,
  WaterLevelDataSchema,
  ObservatoryListSchema,
  WaterLevelResponseSchema,
  STATION_CODE_MAPPING,
  type Observatory,
  type WaterLevelData,
  type ObservatoryList,
  type WaterLevelResponse,
  type IntegratedResponse,
  type StationType,
} from '../apis/types/floodcontrol.types';

export interface MCPRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Retain z import for consumers relying on existing types
export { z };

