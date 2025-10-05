import { z } from 'zod';

export const ObservatorySchema = z.object({
  obs_code: z.string(),
  obs_name: z.string(),
  river_name: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  agency: z.string().optional(),
  ground_level: z.number().optional(),
  warning_levels: z
    .object({
      attention: z.number().optional(),
      warning: z.number().optional(),
      alarm: z.number().optional(),
      serious: z.number().optional(),
      flood_control: z.number().optional(),
    })
    .optional(),
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

export type Observatory = z.infer<typeof ObservatorySchema>;
export type WaterLevelData = z.infer<typeof WaterLevelDataSchema>;
export type ObservatoryList = z.infer<typeof ObservatoryListSchema>;
export type WaterLevelResponse = z.infer<typeof WaterLevelResponseSchema>;

export type StationType = 'dam' | 'waterlevel' | 'rainfall';

export const STATION_CODE_MAPPING: Record<StationType, Record<string, string>> = {
  dam: {
    '대청댐': '3008110',
    '대청호': '3008110',
    '소양댐': '1010690',
    '소양강댐': '1010690',
    '소양호': '1010690',
    '충주댐': '1003110',
    '충주호': '1003110',
    '남강댐': '2018110',
    '남강호': '2018110',
    '광동댐': '1001210',
    '충주조정지댐': '1003611',
    '괴산댐': '1004310',
    '횡성댐': '1006110',
    '평화의댐': '1009710',
    '화천댐': '1010310',
    '춘천댐': '1010320',
    '의암댐': '1013310',
    '청평댐': '1015310',
    '팔당댐': '1010301',
    '군남댐': '1021701',
    '한탄강댐': '1022701',
    '달방댐': '1302210',
    '안동댐': '2001110',
    '안동댐조정지': '2001611',
    '임하댐': '2002110',
    '성덕댐': '2002111',
    '임하댐조정지': '2002610',
    '영주댐': '2004101',
    '군위댐': '2008110',
    '김천부항댐': '2010101',
    '보현산댐': '2012101',
    '영천댐': '2012210',
    '합천댐': '2015110',
    '합천댐조정지': '2018611',
    '밀양댐': '2021110',
    '운문댐': '2021210',
    '대곡댐': '2201231',
    '회야댐': '2301211',
    '감포댐': '2403201',
    '연초댐': '2503210',
    '구천댐': '2503220',
    '용담댐': '3001110',
    '대청댐조정지': '3008611',
    '금강하구둑': '3014410',
    '보령댐': '3203310',
    '구이': '3301651',
    '섬진강댐': '4001110',
    '주암댐': '4007110',
    '광주댐': '5001410',
    '담양댐': '5001420',
    '담양3조절지': '5001600',
    '담양2조절지': '5001604',
    '담양1조절지': '5001608',
    '담양홍수조절지': '5001701',
    '장성댐': '5002410',
    '나주댐': '5003410',
    '화순1조절지': '5003619',
    '화순2조절지': '5003630',
    '화순홍수조절지': '5003701',
    '장흥댐': '5101110',
  },
  waterlevel: {
    '대청댐': '3008690',
    '대청호': '3008690',
    '소양댐': '1010690',
    '소양강댐': '1010690',
    '소양호': '1010690',
    '충주댐': '1003666',
    '충주호': '1003666',
    '남강댐': '2018698',
    '남강호': '2018698',
    '평림댐': '5002201',
    '한강대교': '1018683',
  },
  rainfall: {
    '대청댐': '3008690',
    '대청호': '3008690',
    '소양댐': '1010690',
    '소양강댐': '1010690',
    '소양호': '1010690',
    '충주댐': '1003666',
    '충주호': '1003666',
    '평림댐': '5002201',
  },
};

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
