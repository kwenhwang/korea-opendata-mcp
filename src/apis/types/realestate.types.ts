export interface Transaction {
  거래금액: string;
  거래유형: string;
  건축년도: string;
  년: string;
  월: string;
  일: string;
  아파트: string;
  전용면적: string;
  층: string;
  법정동: string;
  지역코드: string;
  일련번호: string;
  해제여부: string;
}

export interface RealEstateAPIResponse {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: Transaction | Transaction[] | undefined;
      };
      totalCount?: number | string;
      pageNo?: number | string;
      numOfRows?: number | string;
    };
  };
}

export const REGION_CODES = {
  '서울_종로구': '11110',
  '서울_중구': '11140',
  '서울_용산구': '11170',
  '서울_강남구': '11680',
  '서울_서초구': '11650',
  '서울_송파구': '11710',
  '부산_중구': '26110',
  '대구_중구': '27110',
  '인천_중구': '28110',
} as const;

type RegionCodesMap = typeof REGION_CODES;

export type RegionCode = RegionCodesMap[keyof RegionCodesMap];

export interface NormalizedTransaction {
  transactionId: string;
  regionCode: string;
  regionLabel: string;
  apartmentName: string;
  dealDate: string;
  dealType?: string;
  priceTenThousandWon: number;
  priceWon: number;
  areaSquareMeter: number;
  areaPyeong: number;
  floor: number | null;
  constructionYear: number | null;
  raw: Transaction;
}
