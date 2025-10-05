import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  IntegratedResponse,
  RealEstateSearchResult,
} from './types';
import { KoreaOpenDataAPIClient } from './korea-opendata-api';

export class MCPHandler {
  private client: KoreaOpenDataAPIClient;

  constructor() {
    this.client = new KoreaOpenDataAPIClient();
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      const { method, params, id } = request;

      switch (method) {
        case 'initialize':
          return this.handleInitialize(id);
        
        case 'tools/list':
          return this.handleToolsList(id);
        
        case 'tools/call':
          return await this.handleToolsCall(id, params);
        
        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Unknown method: ${method}`,
            },
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      };
    }
  }

  private handleInitialize(id: string | number): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true
          },
        },
        serverInfo: {
          name: 'korea-opendata-mcp',
          version: '1.0.0',
        },
      },
    };
  }

  private handleToolsList(id: string | number): MCPResponse {
    const tools: MCPTool[] = [
      {
        name: 'get_water_info',
        description: '관측소 검색 및 실시간 수위 데이터 통합 조회 (ChatGPT 무한 반복 방지용)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '검색어 (관측소명, 하천명, 위치)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_realestate_info',
        description: '아파트 실거래가 조회 (지역명 또는 아파트명으로 검색)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '지역명 또는 아파트명',
            },
            yearMonth: {
              type: 'string',
              description: '거래년월 (YYYYMM) - 미입력 시 최신 월 기준',
              pattern: '^\\d{6}$',
            },
          },
          required: ['query'],
        },
      },
    ];

    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools,
      },
    };
  }

  private async handleToolsCall(id: string | number, params: any): Promise<MCPResponse> {
    // 파라미터 유효성 검사
    if (!params) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: '필수 파라미터 "params"가 누락되었습니다.',
        },
      };
    }

    if (!params.name) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: '필수 파라미터 "name"이 누락되었습니다.',
        },
      };
    }

    const { name, arguments: args } = params;

    let result: any;

    switch (name) {
      case 'get_water_info':
        if (!args) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: '필수 파라미터 "arguments"가 누락되었습니다.',
            },
          };
        }
        if (!args.query) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: '필수 파라미터 "query"가 누락되었습니다.',
            },
          };
        }
        result = await this.client.searchAndGetData(args.query);
        break;

      case 'get_realestate_info':
        if (!args) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: '필수 파라미터 "arguments"가 누락되었습니다.',
            },
          };
        }
        if (!args.query) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: '필수 파라미터 "query"가 누락되었습니다.',
            },
          };
        }
        result = await this.client.getRealEstateInfo(args.query, args.yearMonth);
        break;

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Unknown tool: ${name}`,
          },
        };
    }

    // 통합 응답인 경우 특별한 형태로 반환
    if (name === 'get_water_info' && result.status) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: this.formatIntegratedResponse(result),
            },
          ],
        },
      };
    }

    if (name === 'get_realestate_info') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: this.formatRealEstateResponse(result as RealEstateSearchResult),
            },
          ],
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  }

  private formatIntegratedResponse(response: IntegratedResponse): string {
    if (response.status === 'error') {
      return `❌ ${response.direct_answer}`;
    }

    const { primary_station, related_stations } = response.detailed_data;
    
    let formatted = `🌊 **${primary_station.name} 실시간 수위 정보**\n\n`;
    formatted += `📊 **현재 상태**: ${response.direct_answer}\n\n`;
    formatted += `📈 **상세 정보**:\n`;
    formatted += `• 수위: ${primary_station.current_level}\n`;
    formatted += `• 저수율: ${primary_station.storage_rate}\n`;
    formatted += `• 상태: ${primary_station.status}\n`;
    formatted += `• 추세: ${primary_station.trend}\n`;
    formatted += `• 최종 업데이트: ${primary_station.last_updated}\n`;

    if (related_stations && related_stations.length > 0) {
      formatted += `\n🔗 **관련 관측소**:\n`;
      related_stations.forEach(station => {
        formatted += `• ${station.name} (코드: ${station.code})\n`;
      });
    }

    formatted += `\n⏰ 조회 시간: ${new Date(response.timestamp).toLocaleString('ko-KR')}`;
    
    return formatted;
  }

  private formatRealEstateResponse(result: RealEstateSearchResult): string {
    const { yearMonth } = result;
    const year = yearMonth.slice(0, 4);
    const month = yearMonth.slice(4, 6);
    const periodLabel = yearMonth.length === 6 ? `${year}년 ${month}월` : '선택한 기간';

    if (result.status === 'error') {
      return `❌ ${result.message ?? '실거래가 정보를 조회할 수 없습니다.'}`;
    }

    if (result.transactions.length === 0) {
      const fallback = result.message
        ? `⚠️ ${result.message}`
        : '⚠️ 해당 기간에 거래 데이터가 없습니다.';
      return fallback;
    }

    const focusRegion = result.region
      ? result.region.label.replace(/_/g, ' ')
      : '여러 지역';
    const filterLabel = result.apartmentFilter ? ` - ${result.apartmentFilter}` : '';

    let output = `🏢 **${focusRegion}${filterLabel} ${periodLabel} 실거래가**\n\n`;

    if (result.message) {
      output += `ℹ️ ${result.message}\n\n`;
    }

    const topTransactions = result.transactions.slice(0, 5);

    topTransactions.forEach((tx, index) => {
      const priceWon = tx.priceWon.toLocaleString('ko-KR');
      const priceTenThousand = tx.priceTenThousandWon.toLocaleString('ko-KR');
      const areaSqm = tx.areaSquareMeter.toFixed(2);
      const areaPyeong = tx.areaPyeong.toFixed(2);
      const floorLabel = tx.floor !== null ? `${tx.floor}층` : '층 정보 없음';
      const dealType = tx.dealType ? ` • 거래유형: ${tx.dealType}` : '';
      const builtYear = tx.constructionYear ? ` • 준공: ${tx.constructionYear}년` : '';
      const dealDate = tx.dealDate.replace(/-/g, '.');
      const regionLabel = tx.regionLabel.replace(/_/g, ' ');

      output += `${index + 1}. ${tx.apartmentName} (${regionLabel}) - ${dealDate}\n`;
      output += `   • 거래금액: ${priceWon}원 (${priceTenThousand}만원)\n`;
      output += `   • 전용면적: ${areaSqm}㎡ (${areaPyeong}평)\n`;
      output += `   • ${floorLabel}${dealType}${builtYear}\n`;
    });

    if (result.transactions.length > topTransactions.length) {
      output += `\n… 총 ${result.transactions.length}건 중 상위 ${topTransactions.length}건을 표시했습니다.`;
    }

    output += '\n\n출처: 국토교통부 실거래가 공개시스템';
    return output;
  }
}
