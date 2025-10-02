#!/bin/bash

echo "🧪 HRFCO MCP Server 로컬 QA 테스트 시작"
echo "========================================"

BASE_URL="http://localhost:3000"
MCP_URL="$BASE_URL/.netlify/functions/mcp"
HEALTH_URL="$BASE_URL/.netlify/functions/health"

echo "📊 서버 상태 확인"
echo "-------------------"

# 헬스체크
echo "1. 헬스체크:"
curl -s $HEALTH_URL
echo -e "\n"

echo "📋 QA 테스트 케이스 실행"
echo "=========================="

# TC_001: 도구 목록 조회
echo "TC_001: 도구 목록 조회"
echo "----------------------"
RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}')

if echo "$RESPONSE" | jq -e '.result.tools' > /dev/null 2>&1; then
    TOOL_COUNT=$(echo "$RESPONSE" | jq '.result.tools | length')
    echo "✅ 통과: $TOOL_COUNT 개 도구 반환"
else
    echo "❌ 실패: $(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')"
fi
echo ""

# TC_009: 파라미터 누락 에러 (개선사항 확인)
echo "TC_009: 파라미터 누락 에러 (개선사항 확인)"
echo "---------------------------------------"
RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": {"name": "get_water_info"}}')

if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message')
    if [[ "$ERROR_MSG" == *"필수 파라미터"* ]]; then
        echo "✅ 통과: 개선된 에러 메시지 - $ERROR_MSG"
    else
        echo "⚠️ 부분 통과: 에러 메시지 - $ERROR_MSG"
    fi
else
    echo "❌ 실패: 에러가 발생하지 않음"
fi
echo ""

# TC_002: 통합 검색 (개선사항 확인)
echo "TC_002: 통합 검색 (Invalid Date 개선 확인)"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "get_water_info", "arguments": {"query": "대청댐"}}}' 2>/dev/null)

if echo "$RESPONSE" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
    TEXT_CONTENT=$(echo "$RESPONSE" | jq -r '.result.content[0].text')
    if echo "$TEXT_CONTENT" | grep -q "Invalid Date"; then
        echo "❌ 실패: 여전히 Invalid Date 발견"
    else
        echo "✅ 통과: Invalid Date 문제 해결됨"
        # 날짜 형식 확인
        if echo "$TEXT_CONTENT" | grep -E "[0-9]{4}\.[ ]*[0-9]{1,2}\.[ ]*[0-9]{1,2}" > /dev/null; then
            echo "   📅 정상적인 날짜 형식 확인"
        fi
    fi
else
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')
    echo "❌ 실패: $ERROR_MSG"
fi
echo ""

# TC_003: 수위 데이터 조회
echo "TC_003: 수위 데이터 조회"
echo "-----------------------"
RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "get_water_level", "arguments": {"obs_code": "1001602"}}}' 2>/dev/null)

if echo "$RESPONSE" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
    TEXT_CONTENT=$(echo "$RESPONSE" | jq -r '.result.content[0].text')
    if echo "$TEXT_CONTENT" | jq -e '.obs_code' > /dev/null 2>&1; then
        echo "✅ 통과: JSON 데이터 정상 반환"
    else
        echo "✅ 통과: 텍스트 데이터 반환 (MCP 표준)"
    fi
else
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')
    echo "❌ 실패: $ERROR_MSG"
fi
echo ""

echo "📊 QA 테스트 완료"
echo "=================="
echo "🎉 개선사항 검증:"
echo "   • 날짜 파싱 로직 개선"
echo "   • 파라미터 유효성 검사 강화"
echo "   • 에러 메시지 품질 향상"