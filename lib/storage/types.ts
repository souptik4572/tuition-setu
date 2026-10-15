export interface FileStorage {
  save(key: string, bytes: Uint8Array): Promise<void>;
  read(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
  signedUrl?(key: string): Promise<string>; // hosted only: short-lived URL (SPEC §19.7)
}
