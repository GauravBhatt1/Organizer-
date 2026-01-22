export type Page = 'Dashboard' | 'Movies' | 'TV Shows' | 'Uncategorized' | 'Settings';

export interface MediaItem {
  id: number;
  title: string;
  year: number;
  posterPath: string;
  overview: string;
  filePath?: string;
}

export interface UncategorizedItem {
  id: string;
  filePath: string;
  fileName: string;
}

export interface TmdbSearchResult {
  id: number;
  title: string;
  year: number;
  posterPath: string;
  overview: string;
}

export interface ScanJob {
  id: string;
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
  totalFiles: number;
  processedFiles: number;
  errors: string[];
}

export interface TmdbTestResult {
  ok: boolean;
  status: 'VALID' | 'INVALID' | 'FAILED';
  type: 'v3' | 'v4' | null;
  httpStatus: number | null;
  message: string;
}