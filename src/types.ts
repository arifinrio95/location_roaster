export interface LocationResult {
  lat: number;
  lng: number;
  displayName: string;
  polygon?: [number, number][];
}

export interface OsmAmenity {
  type: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
  distance?: number;
}

export interface ReceiptData {
  category: "banjir" | "begal" | "macet" | "sutet" | "krl" | "kuburan" | "sampah";
  title: string;
  source: string;
  link: string;
  lat: number;
  lng: number;
}

export interface VerifiedArticle {
  title: string;
  source: string;
  link: string;
  category: string;
}

export interface RoastResult {
  score: number;
  dimensions: {
    banjir: number;
    kriminal: number;
    macet: number;
    akses_transit: number;
    polusi_gaib: number; // For sutet/kuburan/sampah
  };
  roastParagraph: string;
  prosParagraph: string;
  sabda: string;
  receipts: ReceiptData[];
  verifiedArticles?: VerifiedArticle[];
}
