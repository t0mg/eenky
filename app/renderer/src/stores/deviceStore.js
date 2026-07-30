import { defineStore } from 'pinia';
import { EenkSerialProtocol } from '../core/serialProtocol.js';

export const useDeviceStore = defineStore('device', {
    state: () => ({
        isConnected: false,
        isConnecting: false,
        protocolVersion: null,
        sdInfo: { total: 0, used: 0, free: 0 },
        stories: [],     
        saves: [],       
        transferState: null,  
        error: null,
    }),
    actions: {
        async connect() {
            this.isConnecting = true;
            this.error = null;
            try {
                if (!this._protocol) {
                    this._protocol = new EenkSerialProtocol();
                }
                const res = await this._protocol.connect();
                this.protocolVersion = res.version;
                this.isConnected = true;
                await this.refreshFiles();
            } catch (e) {
                this.error = e.message;
                this.isConnected = false;
                if (this._protocol) {
                    await this._protocol.disconnect();
                }
            } finally {
                this.isConnecting = false;
            }
        },
        
        async disconnect() {
            if (this._protocol) {
                await this._protocol.disconnect();
            }
            this.isConnected = false;
            this.protocolVersion = null;
            this.stories = [];
            this.saves = [];
            this.sdInfo = { total: 0, used: 0, free: 0 };
            this.transferState = null;
        },
        
        async refreshFiles() {
            if (!this.isConnected || !this._protocol) return;
            try {
                this.sdInfo = await this._protocol.getInfo();
                
                if (this.sdInfo.total === 0) {
                    console.warn("SD Card total size reported as 0, but attempting to list files anyway.");
                }
                
                try {
                    const storyFiles = await this._protocol.listFiles('/stories');
                    this.stories = storyFiles.map(f => ({ ...f, path: `/stories/${f.name}` }));
                } catch(e) {
                    if (e.message && e.message.includes('NOT_FOUND')) {
                        this.stories = [];
                    } else {
                        throw e;
                    }
                }
                
                let saveFiles = [];
                try {
                    saveFiles = await this._protocol.listFiles('/.eenk_saves');
                    this.saves = saveFiles.map(f => ({ ...f, path: `/.eenk_saves/${f.name}` }));
                } catch(e) {
                    if (e.message && e.message.includes('NOT_FOUND')) {
                        this.saves = [];
                    } else {
                        throw e;
                    }
                }
            } catch (e) {
                this.error = "Error refreshing files: " + e.message;
            }
        },
        
        async uploadStoryBundle(file) {
            if (!this.isConnected || !this._protocol) return;
            
            try {
                this.transferState = { type: 'upload', filename: file.name, bytesTotal: file.size, bytesTransferred: 0 };
                
                // Read the whole file for now
                const arrayBuffer = await file.arrayBuffer();
                const data = new Uint8Array(arrayBuffer);
                
                // Read title from header (bytes 8-71)
                let title = file.name.replace('.bin', '');
                if (data.length >= 72) {
                    const magic = new TextDecoder().decode(data.slice(0, 4));
                    if (magic === 'eenk') {
                        const titleBytes = data.slice(8, 72);
                        const endIdx = titleBytes.indexOf(0);
                        if (endIdx > 0) {
                            title = new TextDecoder().decode(titleBytes.slice(0, endIdx));
                        }
                    }
                }
                
                const folderName = title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 32);
                
                try {
                    await this._protocol.mkdir(`/stories/${folderName}`);
                } catch (e) {
                    // ignore mkdir error if exists
                }
                
                await this._protocol.uploadFile(`/stories/${folderName}/main.bin`, data, (transferred, total) => {
                    this.transferState.bytesTransferred = transferred;
                    this.transferState.bytesTotal = total;
                });
                
                // Handle sidecars via preload API if available (Electron environment)
                const STORY_SIDECAR_EXTENSIONS = ['.epdfont', '.media'];
                if (file.path && window.api && window.api.fs && window.api.path) {
                    try {
                        const dirPath = await window.api.path.dirname(file.path);
                        const baseName = await window.api.path.basename(file.path, '.bin');
                        
                        const files = await window.api.fs.readdir(dirPath);
                        for (const f of files) {
                            const ext = await window.api.path.extname(f);
                            if (STORY_SIDECAR_EXTENSIONS.includes(ext) && f.startsWith(baseName)) {
                                const fullPath = await window.api.path.join(dirPath, f);
                                const buf = await window.api.fs.readFile(fullPath);
                                const u8 = new Uint8Array(buf);
                                
                                this.transferState.filename = f;
                                await this._protocol.uploadFile(`/stories/${folderName}/${f}`, u8, (transferred, total) => {
                                    this.transferState.bytesTransferred = transferred;
                                    this.transferState.bytesTotal = total;
                                });
                            }
                        }
                    } catch (sidecarErr) {
                        console.warn("Failed to upload sidecars:", sidecarErr);
                    }
                }
                
                await this.refreshFiles();
            } catch (e) {
                this.error = "Upload failed: " + e.message;
            } finally {
                this.transferState = null;
            }
        },
        
        async deleteItem(path) {
             if (!this.isConnected || !this._protocol) return;
             try {
                 await this._protocol.deleteFile(path);
                 await this.refreshFiles();
             } catch (e) {
                 this.error = e.message;
             }
        },
        
        async downloadFile(path, filename) {
             if (!this.isConnected || !this._protocol) return;
             try {
                this.transferState = { type: 'download', filename: filename, bytesTotal: 0, bytesTransferred: 0 };
                
                const data = await this._protocol.downloadFile(path, (transferred, total) => {
                    this.transferState.bytesTransferred = transferred;
                    this.transferState.bytesTotal = total;
                });
                
                // Trigger download in browser
                const blob = new Blob([data]);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
             } catch (e) {
                 this.error = "Download failed: " + e.message;
             } finally {
                 this.transferState = null;
             }
        }
    }
});
