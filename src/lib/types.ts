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
  // 댐 API (dam/list.json, dam/info.json) - 모든 댐 포함 (55개)
  dam: {
    // 기존 주요 댐들 (별칭 포함)
    '대청댐': '3008110', // 대청댐 - 한국수자원공사
    '대청호': '3008110', // 대청댐 별칭 (호수명)
    '소양댐': '1012110', // 소양강댐 - 한국수자원공사
    '소양강댐': '1012110', // 소양강댐 별칭 추가
    '소양호': '1012110', // 소양강댐 별칭 (호수명)
    '충주댐': '1003110', // 충주댐 - 한국수자원공사
    '충주호': '1003110', // 충주댐 별칭 (호수명)
    '남강댐': '2018110', // 남강댐 - 한국수자원공사
    '남강호': '2018110', // 남강댐 별칭 (호수명)
    
    // 모든 댐 추가 (55개)
    '광동댐': '1001210', // 광동댐 - 한국수자원공사
    '충주조정지댐': '1003611', // 충주조정지댐 - 한국수자원공사
    '괴산댐': '1004310', // 괴산댐 - 한국수력원자력
    '횡성댐': '1006110', // 횡성댐 - 한국수자원공사
    '평화의댐': '1009710', // 평화의댐 - 한국수자원공사
    '화천댐': '1010310', // 화천댐 - 한국수력원자력
    '춘천댐': '1010320', // 춘천댐 - 한국수력원자력
    '의암댐': '1013310', // 의암댐 - 한국수력원자력
    '청평댐': '1015310', // 청평댐 - 한국수력원자력
    '팔당댐': '1017310', // 팔당댐 - 한국수력원자력
    '군남댐': '1021701', // 군남댐 - 한국수자원공사
    '한탄강댐': '1022701', // 한탄강댐 - 한국수자원공사
    '달방댐': '1302210', // 달방댐 - 한국수자원공사
    '안동댐': '2001110', // 안동댐 - 한국수자원공사
    '안동댐조정지': '2001611', // 안동댐조정지 - 한국수자원공사
    '임하댐': '2002110', // 임하댐 - 한국수자원공사
    '성덕댐': '2002111', // 성덕댐 - 한국수자원공사
    '임하댐조정지': '2002610', // 임하댐조정지 - 한국수자원공사
    '영주댐': '2004101', // 영주댐 - 한국수자원공사
    '군위댐': '2008110', // 군위댐 - 한국수자원공사
    '김천부항댐': '2010101', // 김천부항댐 - 한국수자원공사
    '보현산댐': '2012101', // 보현산댐 - 한국수자원공사
    '영천댐': '2012210', // 영천댐 - 한국수자원공사
    '합천댐': '2015110', // 합천댐 - 한국수자원공사
    '합천댐조정지': '2018611', // 합천댐조정지 - 한국수자원공사
    '밀양댐': '2021110', // 밀양댐 - 한국수자원공사
    '운문댐': '2021210', // 운문댐 - 한국수자원공사
    '대곡댐': '2201231', // 대곡댐 - 한국수자원공사
    '회야댐': '2301211', // 회야댐 - null
    '감포댐': '2403201', // 감포댐 - 한국수자원공사
    '연초댐': '2503210', // 연초댐 - 한국수자원공사
    '구천댐': '2503220', // 구천댐 - 한국수자원공사
    '용담댐': '3001110', // 용담댐 - 한국수자원공사
    '대청댐조정지': '3008611', // 대청댐조정지 - 한국수자원공사
    '금강하구둑': '3014410', // 금강하구둑 - 한국농어촌공사
    '보령댐': '3203310', // 보령댐 - 한국수자원공사
    '구이': '3301651', // 구이 - 한국농어촌공사
    '섬진강댐': '4001110', // 섬진강댐 - 한국수자원공사
    '주암댐': '4007110', // 주암댐 - 한국수자원공사
    '광주댐': '5001410', // 광주댐 - 한국농어촌공사
    '담양댐': '5001420', // 담양댐 - 한국농어촌공사
    '담양3조절지': '5001600', // 담양3조절지 - 한국수자원공사
    '담양2조절지': '5001604', // 담양2조절지 - 한국수자원공사
    '담양1조절지': '5001608', // 담양1조절지 - 한국수자원공사
    '담양홍수조절지': '5001701', // 담양홍수조절지 - 한국수자원공사
    '장성댐': '5002410', // 장성댐 - 한국농어촌공사
    '나주댐': '5003410', // 나주댐 - 한국농어촌공사
    '화순1조절지': '5003619', // 화순1조절지 - 한국수자원공사
    '화순2조절지': '5003630', // 화순2조절지 - 한국수자원공사
    '화순홍수조절지': '5003701', // 화순홍수조절지 - 한국수자원공사
    '장흥댐': '5101110', // 장흥댐 - 한국수자원공사
  },
  // 수위관측소 API (waterlevel/list.json, waterlevel/info.json)
  waterlevel: {
    '대청댐': '3008690', // 청주시(대청댐) - 한국수자원공사
    '대청호': '3008690', // 대청댐 별칭 (호수명) - 한국수자원공사
    '소양댐': '1010690', // 춘천시(춘천댐) - 환경부
    '소양강댐': '1010690', // 춘천시(춘천댐) 별칭 추가 - 환경부
    '소양호': '1010690', // 소양강댐 별칭 (호수명) - 환경부
    '충주댐': '1003666', // 충주시(충주댐) - 한국수자원공사
    '충주호': '1003666', // 충주댐 별칭 (호수명) - 한국수자원공사
    '남강댐': '2018698', // 진주시(남강댐방수로) - 한국수자원공사
    '남강호': '2018698', // 남강댐 별칭 (호수명) - 한국수자원공사
    '평림댐': '5002201', // 평림댐 - 한국수자원공사
    '한강대교': '1018683', // 서울시(한강대교) - 환경부
  },
  // 우량관측소 API (rainfall/list.json, rainfall/info.json)
  rainfall: {
    '대청댐': '3008690', // 청주시(대청댐) - 한국수자원공사
    '대청호': '3008690', // 대청댐 별칭 (호수명) - 한국수자원공사
    '소양댐': '1010690', // 춘천시(춘천댐) - 환경부
    '소양강댐': '1010690', // 춘천시(춘천댐) 별칭 추가 - 환경부
    '소양호': '1010690', // 소양강댐 별칭 (호수명) - 환경부
    '충주댐': '1003666', // 충주시(충주댐) - 한국수자원공사
    '충주호': '1003666', // 충주댐 별칭 (호수명) - 한국수자원공사
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
      inflow?: string;
      outflow?: string;
      current_storage?: string;
      total_storage?: string;
      storage_calculation_note?: string;
      flood_limit_level?: string;
      water_level_analysis?: {
        status: string;
        message: string;
        level_difference: number | null;
        percentage_difference: number;
        risk_level: string;
        flood_limit_level: number;
      };
    };
    water_level_station?: {
      name: string;
      code: string;
      current_level?: string;
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
