import { z } from 'zod';

// HRFCO API 응답 타입
export const ObservatorySchema = z.object({
  obs_code: z.string(),
  obs_name: z.string(),
  river_name: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const WaterLevelDataSchema = z.object({
  obs_code: z.string(),
  obs_time: z.string(),
  water_level: z.number(),
  unit: z.string().optional(),
});

export const ObservatoryListSchema = z.object({
  result: z.array(ObservatorySchema),
  total_count: z.number().optional(),
});

export const WaterLevelResponseSchema = z.object({
  result: z.array(WaterLevelDataSchema),
});

// MCP 타입
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

// 관측소 타입별 코드 매핑
export const STATION_CODE_MAPPING = {
  // 댐 API (dam/list.json, dam/info.json)
  dam: {
    '대청댐': '3008110', // 대청댐 - 한국수자원공사
    '소양댐': '1012110', // 소양댐 - 한국수자원공사 (추정)
    '충주댐': '1003110', // 충주댐 - 한국수자원공사 (추정)
    '평림댐': '2012110', // 평림댐 - 한국수자원공사 (추정)
  },
  // 수위관측소 API (waterlevel/list.json, waterlevel/info.json)
  waterlevel: {
    '대청댐': '3008690', // 청주시(대청댐) - 한국수자원공사
    '소양댐': '1010690', // 춘천시(춘천댐) - 환경부
    '충주댐': '1003666', // 충주시(충주댐) - 한국수자원공사
    '평림댐': '5002201', // 평림댐 - 한국수자원공사
    '한강대교': '1018683', // 서울시(한강대교) - 환경부
  },
  // 우량관측소 API (rainfall/list.json, rainfall/info.json)
  rainfall: {
    '대청댐': '3008690', // 청주시(대청댐) - 한국수자원공사
    '소양댐': '1010690', // 춘천시(춘천댐) - 환경부
    '충주댐': '1003666', // 충주시(충주댐) - 한국수자원공사
    '평림댐': '5002201', // 평림댐 - 한국수자원공사
  }
};

// 통합 응답 타입
export interface IntegratedResponse {
  status: 'success' | 'error';
  summary: string;
  direct_answer: string;
  detailed_data: {
    primary_station: {
      name: string;
      code: string;
      current_level?: string;
      storage_rate?: string;
      status?: string;
      trend?: string;
      last_updated?: string;
    };
    related_stations?: Array<{
      name: string;
      code: string;
      current_level?: string;
      status?: string;
    }>;
  };
  timestamp: string;
}

// 타입 추출
export type Observatory = z.infer<typeof ObservatorySchema>;
export type WaterLevelData = z.infer<typeof WaterLevelDataSchema>;
export type ObservatoryList = z.infer<typeof ObservatoryListSchema>;
export type WaterLevelResponse = z.infer<typeof WaterLevelResponseSchema>;
