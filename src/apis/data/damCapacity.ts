// 홍수통제소 기준 주요 댐의 총저수용량 정보 (단위: 백만㎥)
export interface DamCapacityInfo {
  name: string;
  totalCapacity: number;
  watershed: string;
}

export const DAM_CAPACITY_DATA: Record<string, DamCapacityInfo> = {
  // 한강 수계 (대형댐)
  '1012110': { name: '소양강댐', totalCapacity: 2900, watershed: '한강 수계' },
  '1003110': { name: '충주댐', totalCapacity: 2750, watershed: '한강 수계' },
  '1009710': { name: '평화의댐', totalCapacity: 2630, watershed: '한강 수계' },
  '1022701': { name: '한탄강댐', totalCapacity: 270, watershed: '한강 수계' },
  '1015310': { name: '청평댐', totalCapacity: 185, watershed: '한강 수계' },
  '1010320': { name: '춘천댐', totalCapacity: 149, watershed: '한강 수계' },
  '1006110': { name: '횡성댐', totalCapacity: 87, watershed: '한강 수계' },
  '1013310': { name: '의암댐', totalCapacity: 80, watershed: '한강 수계' },
  '1021701': { name: '군남댐', totalCapacity: 71.6, watershed: '한강 수계' },
  '1017310': { name: '팔당댐', totalCapacity: 244, watershed: '한강 수계' },
  '1010310': { name: '화천댐', totalCapacity: 1018, watershed: '한강 수계' },
  '1001210': { name: '광동댐', totalCapacity: 13.23, watershed: '한강 수계' },

  // 금강 수계
  '3008110': { name: '대청댐', totalCapacity: 1490, watershed: '금강 수계' },
  '3001110': { name: '용담댐', totalCapacity: 815, watershed: '금강 수계' },
  '3203310': { name: '보령댐', totalCapacity: 117, watershed: '금강 수계' },
  '1004310': { name: '괴산댐', totalCapacity: 55, watershed: '금강 수계' },

  // 낙동강 수계
  '2001110': { name: '안동댐', totalCapacity: 1248, watershed: '낙동강 수계' },
  '2015110': { name: '합천댐', totalCapacity: 790, watershed: '낙동강 수계' },
  '2002110': { name: '임하댐', totalCapacity: 595, watershed: '낙동강 수계' },
  '2018110': { name: '남강댐', totalCapacity: 309, watershed: '낙동강 수계' },
  '2004101': { name: '영주댐', totalCapacity: 181, watershed: '낙동강 수계' },
  '2021210': { name: '운문댐', totalCapacity: 74, watershed: '낙동강 수계' },
  '2021110': { name: '밀양댐', totalCapacity: 74, watershed: '낙동강 수계' },
  '2008110': { name: '군위댐', totalCapacity: 49, watershed: '낙동강 수계' },
  '2010101': { name: '김천부항댐', totalCapacity: 54, watershed: '낙동강 수계' },
  '2012101': { name: '보현산댐', totalCapacity: 22, watershed: '낙동강 수계' },
  '2012210': { name: '영천댐', totalCapacity: 66.4, watershed: '낙동강 수계' },
  '2002111': { name: '성덕댐', totalCapacity: 28, watershed: '낙동강 수계' },
  '2201231': { name: '대곡댐', totalCapacity: 28.5, watershed: '낙동강 수계' },

  // 섬진강 수계
  '4007110': { name: '주암댐', totalCapacity: 707, watershed: '섬진강 수계' },
  '4001110': { name: '섬진강댐', totalCapacity: 466, watershed: '섬진강 수계' },

  // 영산강 수계
  '5101110': { name: '장흥댐', totalCapacity: 191, watershed: '영산강 수계' },
  '5001410': { name: '광주댐', totalCapacity: 119, watershed: '영산강 수계' },
  '5002410': { name: '장성댐', totalCapacity: 86, watershed: '영산강 수계' },
  '5003410': { name: '나주댐', totalCapacity: 127, watershed: '영산강 수계' },
  '5001420': { name: '담양댐', totalCapacity: 135, watershed: '영산강 수계' },

  // 기타 소형댐
  '1302210': { name: '달방댐', totalCapacity: 5.5, watershed: '기타 수계' },
  '2403201': { name: '감포댐', totalCapacity: 2.3, watershed: '기타 수계' },
  '2503210': { name: '연초댐', totalCapacity: 5.0, watershed: '기타 수계' },
  '2503220': { name: '구천댐', totalCapacity: 1.2, watershed: '기타 수계' },
  '2301211': { name: '회야댐', totalCapacity: 8.5, watershed: '기타 수계' },
};

export function calculateStorageRate(currentStorage: number, damCode: string): number | null {
  const damInfo = DAM_CAPACITY_DATA[damCode];
  if (!damInfo || !Number.isFinite(currentStorage) || currentStorage <= 0) {
    return null;
  }

  return Math.round((currentStorage / damInfo.totalCapacity) * 100);
}

export function getWatershedDams(damCode: string): Array<{ code: string; name: string }> {
  const damInfo = DAM_CAPACITY_DATA[damCode];
  if (!damInfo) {
    return [];
  }

  return Object.entries(DAM_CAPACITY_DATA)
    .filter(([code, info]) => code !== damCode && info.watershed === damInfo.watershed)
    .map(([code, info]) => ({ code, name: info.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}

export function getDamCapacityInfo(damCode: string): DamCapacityInfo | undefined {
  return DAM_CAPACITY_DATA[damCode];
}
