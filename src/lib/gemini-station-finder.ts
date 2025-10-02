import { GoogleGenerativeAI } from '@google/generative-ai';
import { Observatory } from './types';
import { STATION_CODE_MAPPING } from './types';

export class GeminiStationFinder {
  private model: any;
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
  }

  async findStations(userQuery: string, dataType: string = 'waterlevel'): Promise<Array<{code: string, name: string}>> {
    // Gemini 사용 불가시 빈 배열 반환 (기존 로직이 처리)
    if (!this.model) {
      console.warn('⚠️ Gemini 사용 불가, 기존 매칭 로직을 사용하세요.');
      return [];
    }

    // 관측소 데이터베이스 준비
    const stationDB = Object.entries(STATION_CODE_MAPPING).map(([name, code]) => ({
      code,
      name
    }));
    
    const prompt = `
사용자 질문: "${userQuery}"
데이터 타입: "${dataType}"

다음 관측소 DB에서 가장 적합한 관측소를 찾아주세요:
${JSON.stringify(stationDB, null, 2)}

JSON 응답 (정확히 이 형식):
{
  "matches": [
    {
      "code": "관측소코드",
      "name": "관측소명", 
      "confidence": 0-100
    }
  ]
}

규칙:
- confidence 80 이상만 반환
- 최대 3개까지
- 존재하지 않는 지역 → matches: []
- dataType과 일치하는 것만 (waterlevel: 댐/대교, rainfall: 강우관측소)
- JSON만 반환, 다른 설명 없음
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = JSON.parse(result.response.text());
      
      console.log('🎯 Gemini 매칭 결과:', response.matches);
      
      // confidence 80 이상인 것만 반환
      return response.matches
        .filter((match: any) => match.confidence >= 80)
        .map((match: any) => ({
          code: match.code,
          name: match.name
        }));
      
    } catch (error) {
      console.error('❌ Gemini Station Finding Error:', error);
      return []; // 실패시 빈 배열 (기존 로직으로 폴백)
    }
  }
}
