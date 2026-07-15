export interface StorageProvider {
  save(buffer: Buffer, path: string): Promise<string>;
  read(path: string): Promise<Buffer>;
  delete?(path: string): Promise<void>;
}
export default StorageProvider;
