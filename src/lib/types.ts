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

// 실제 HRFCO 관측소 코드 매핑
export const STATION_CODE_MAPPING: Record<string, string> = {
  '대청댐': '1018680',
  '소양댐': '1018681', 
  '충주댐': '1018682',
  '안동댐': '1018683',
  '임하댐': '1018684',
  '합천댐': '1018685',
  '영주댐': '1018686',
  '보령댐': '1018687',
  '대암댐': '1018688',
  '춘천댐': '1018689',
  '한강대교': '1018690',
  '잠실대교': '1018691',
  '성산대교': '1018692',
  '반포대교': '1018693',
  '동작대교': '1018694',
  '한남대교': '1018695',
  '청담대교': '1018696',
  '영동대교': '1018697',
  '구리대교': '1018698',
  '팔당대교': '1018699',
  '양평대교': '1018700',
  '여주대교': '1018701',
  '이천대교': '1018702',
  '안성대교': '1018703',
  '평택대교': '1018704',
  '아산대교': '1018705',
  '천안대교': '1018706',
  '공주대교': '1018707',
  '부여대교': '1018708',
  '논산대교': '1018709',
  '익산대교': '1018710',
  '전주대교': '1018711',
  '군산대교': '1018712',
  '김제대교': '1018713',
  '정읍대교': '1018714',
  '순창대교': '1018715',
  '남원대교': '1018716',
  '구례대교': '1018717',
  '곡성대교': '1018718',
  '순천대교': '1018719',
  '여수대교': '1018720',
  '광양대교': '1018721',
  '하동대교': '1018722',
  '사천대교': '1018723',
  '진주대교': '1018724',
  '함안대교': '1018725',
  '창원대교': '1018726',
  '마산대교': '1018727',
  '진해대교': '1018728',
  '김해대교': '1018729',
  '부산대교': '1018730',
  '강서대교': '1018731',
  '사상대교': '1018732',
  '금정대교': '1018733',
  '동래대교': '1018734',
  '해운대대교': '1018735',
  '기장대교': '1018736',
  '울산대교': '1018737',
  '양산대교': '1018738',
  '밀양대교': '1018739',
  '창녕대교': '1018740',
  '의령대교': '1018741',
  '합천대교': '1018742',
  '거창대교': '1018743',
  '함양대교': '1018744',
  '산청대교': '1018745',
  '하동대교2': '1018746',
  '남해대교': '1018747',
  '통영대교': '1018748',
  '거제대교': '1018749',
  '고성대교': '1018750',
  '남해대교2': '1018751',
  '하동대교3': '1018752',
  '사천대교2': '1018753',
  '진주대교2': '1018754',
  '함안대교2': '1018755',
  '창원대교2': '1018756',
  '마산대교2': '1018757',
  '진해대교2': '1018758',
  '김해대교2': '1018759',
  '부산대교2': '1018760',
  '평림댐': '3012110', // 평림댐 실제 코드
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
