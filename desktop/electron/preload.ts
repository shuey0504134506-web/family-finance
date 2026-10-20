import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopStore', {
  read: (name: string): Promise<string | null> => ipcRenderer.invoke('store:read', name),
  write: (name: string, text: string): Promise<void> => ipcRenderer.invoke('store:write', name, text),
  remove: (name: string): Promise<void> => ipcRenderer.invoke('store:remove', name),
  where: (): Promise<string> => ipcRenderer.invoke('store:where'),
});

contextBridge.exposeInMainWorld('desktopFiles', {
  pick: (accept: string, multiple: boolean): Promise<{ name: string; data: Uint8Array }[]> => ipcRenderer.invoke('files:pick', accept, multiple),
});

contextBridge.exposeInMainWorld('desktopUpdate', {
  version: (): Promise<string> => ipcRenderer.invoke('update:version'),
  install: (url: string): Promise<void> => ipcRenderer.invoke('update:install', url),
});
