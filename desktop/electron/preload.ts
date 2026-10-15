import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopStore', {
  read: (name: string): Promise<string | null> => ipcRenderer.invoke('store:read', name),
  write: (name: string, text: string): Promise<void> => ipcRenderer.invoke('store:write', name, text),
  remove: (name: string): Promise<void> => ipcRenderer.invoke('store:remove', name),
  where: (): Promise<string> => ipcRenderer.invoke('store:where'),
});
