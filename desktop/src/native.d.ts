export {};
declare global {
  interface Window {
    desktopStore?: {
      read(name: string): Promise<string | null>;
      write(name: string, text: string): Promise<void>;
      remove(name: string): Promise<void>;
      where(): Promise<string>;
    };
  }
}
