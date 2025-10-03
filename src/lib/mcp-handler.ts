import { MCPRequest, MCPResponse, MCPTool, IntegratedResponse } from './types';
import { HRFCOAPIClient } from './hrfco-api';

export class MCPHandler {
  private client: HRFCOAPIClient;

  constructor() {
    this.client = new HRFCOAPIClient();
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
          name: 'hrfco-mcp-ts',
          version: '1.0.0',
        },
      },
    };
  }

  private handleToolsList(id: string | number): MCPResponse {
    const tools: MCPTool[] = [
      {
        name: 'get_water_level',
        description: '실시간 수위 데이터 조회',
        inputSchema: {
          type: 'object',
          properties: {
            obs_code: {
              type: 'string',
              description: '관측소 코드',
            },
            time_type: {
              type: 'string',
              description: '시간 유형 (1H, 1D 등)',
              default: '1H',
            },
          },
          required: ['obs_code'],
        },
      },
      {
        name: 'get_rainfall',
        description: '실시간 강우량 데이터 조회',
        inputSchema: {
          type: 'object',
          properties: {
            obs_code: {
              type: 'string',
              description: '관측소 코드',
            },
            time_type: {
              type: 'string',
              description: '시간 유형 (1H, 1D 등)',
              default: '1H',
            },
          },
          required: ['obs_code'],
        },
      },
      {
        name: 'get_observatory_list',
        description: '관측소 목록 조회',
        inputSchema: {
          type: 'object',
          properties: {
            hydro_type: {
              type: 'string',
              description: '수문 유형 (waterlevel, flow 등)',
              default: 'waterlevel',
            },
          },
        },
      },
      {
        name: 'search_observatory',
        description: '관측소 검색',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '검색어 (관측소명, 하천명, 위치)',
            },
            hydro_type: {
              type: 'string',
              description: '수문 유형',
              default: 'waterlevel',
            },
          },
          required: ['query'],
        },
      },
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
      case 'get_water_level':
        if (!args || !args.obs_code) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: '필수 파라미터 "obs_code"가 누락되었습니다.',
            },
          };
        }
        result = await this.client.getWaterLevelData(
          args.obs_code,
          args.time_type || '1H'
        );
        break;

      case 'get_rainfall':
        if (!args || !args.obs_code) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: '필수 파라미터 "obs_code"가 누락되었습니다.',
            },
          };
        }
        result = await this.client.getRainfallData(
          args.obs_code,
          args.time_type || '1H'
        );
        break;

      case 'get_observatory_list':
        result = await this.client.getObservatories(
          args.hydro_type || 'waterlevel'
        );
        break;

      case 'search_observatory':
        if (!args || !args.query) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: '필수 파라미터 "query"가 누락되었습니다.',
            },
          };
        }
        const observatories = await this.client.getObservatories(
          args.hydro_type || 'waterlevel'
        );
        result = this.client.searchObservatory(args.query, observatories);
        break;

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
}
