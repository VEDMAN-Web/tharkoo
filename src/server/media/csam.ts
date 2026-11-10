import { InternalError } from "@/server/http";

export interface CsamScanInput {
  objectKey: string;
  contentType?: string;
  bytes?: number;
}

export interface CsamScanResult {
  match: boolean;
  listId?: string;
  hitId?: string;
}

/** Providers after the stub are a later task. Unknown names fail closed. */
export interface CsamScanner {
  scan(input: CsamScanInput): Promise<CsamScanResult>;
}

export function csamScannerFromEnv(): CsamScanner {
  if ((process.env.CSAM_PROVIDER?.trim() || "stub") !== "stub") {
    throw new InternalError("CSAM provider is not available");
  }
  return { async scan() { return { match: false }; } };
}
