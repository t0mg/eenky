<template>
  <div class="device-app" :class="theme">
    <header class="device-header">
      <div class="title-bar">
        <h1><span class="material-symbols-outlined icon-large">usb</span> Device Manager</h1>
        <button v-if="!store.isConnected" @click="store.connect" :disabled="store.isConnecting || connectDisabled" class="primary-btn connect-btn">
          {{ store.isConnecting ? 'Connecting...' : 'Connect' }}
        </button>
        <button v-else @click="handleDisconnect" class="secondary-btn connect-btn">
          Disconnect
        </button>
      </div>
      
      <div class="status-bar" v-if="store.isConnected">
        <div class="status-info">
          <span class="material-symbols-outlined status-icon text-success">check_circle</span>
          <span>Connected (Protocol v{{ store.protocolVersion }})</span>
        </div>
        
        <div class="storage-info" v-if="store.sdInfo.total > 0">
          <div class="storage-text">
            <span>SD Card</span>
            <span>{{ formatSize(store.sdInfo.used) }} / {{ formatSize(store.sdInfo.total) }}</span>
          </div>
          <div class="storage-bar-bg">
            <div class="storage-bar-fill" :style="{ width: (store.sdInfo.used / store.sdInfo.total * 100) + '%' }"></div>
          </div>
        </div>
      </div>
      
      <div class="error-banner" v-if="store.error">
        <span class="material-symbols-outlined">error</span>
        <span>{{ store.error }}</span>
        <button @click="store.error = null" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
      </div>
    </header>

    <main class="device-content">
      <div class="empty-state" v-if="!store.isConnected">
        <span class="material-symbols-outlined empty-icon">link_off</span>
        <h2>Connect your eenk device</h2>
        <p>Connect via USB to manage stories and saves</p>
        <p>The device must be turned on showing the menu (not playing a story)</p>
      </div>

      <div class="file-browser" v-else>
        <div class="tabs">
          <button class="tab-btn" :class="{ active: currentTab === 'Stories' }" @click="currentTab = 'Stories'">
            <span class="material-symbols-outlined">description</span> Stories
          </button>
          <button class="tab-btn" :class="{ active: currentTab === 'Saves' }" @click="currentTab = 'Saves'">
            <span class="material-symbols-outlined">storage</span> Saves
          </button>
        </div>

        <!-- Stories Section -->
        <div class="section" v-show="currentTab === 'Stories'">
          <div class="section-header">
            <h2><span class="material-symbols-outlined">description</span> Stories</h2>
            <div class="actions">
                <input type="file" ref="fileInput" accept=".bin" style="display: none" @change="handleFileUpload">
                <button @click="$refs.fileInput.click()" class="primary-btn small-btn" :disabled="store.transferState">
                    <span class="material-symbols-outlined">upload_file</span> Upload Story
                </button>
            </div>
          </div>
          
          <div class="file-list">
            <div v-if="store.stories.length === 0" class="empty-list">No stories found</div>
            <div v-for="item in store.stories" :key="item.path" class="file-item">
              <div class="file-main">
                  <span class="material-symbols-outlined file-icon">{{ item.type === 'D' ? 'folder' : 'draft' }}</span>
                  <span class="file-name">{{ item.name }}</span>
              </div>
              <div class="file-meta">
                  <span class="file-size" v-if="item.type !== 'D'">{{ formatSize(item.size) }}</span>
                  <button @click="confirmDelete(item)" class="icon-btn delete-btn" title="Delete">
                      <span class="material-symbols-outlined">delete</span>
                  </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Saves Section -->
        <div class="section" v-show="currentTab === 'Saves'">
          <div class="section-header">
            <h2><span class="material-symbols-outlined">storage</span> Saves</h2>
          </div>
          
          <div class="file-list">
            <div v-if="store.saves.length === 0" class="empty-list">No saves found</div>
            <div v-for="item in store.saves" :key="item.path" class="file-item">
               <div class="file-main">
                  <span class="material-symbols-outlined file-icon">save</span>
                  <span class="file-name">{{ item.name }}</span>
              </div>
              <div class="file-meta">
                  <span class="file-size">{{ formatSize(item.size) }}</span>
                  <button @click="store.downloadFile(item.path, item.name)" class="icon-btn" title="Download">
                      <span class="material-symbols-outlined">download</span>
                  </button>
                  <button @click="confirmDelete(item)" class="icon-btn delete-btn" title="Delete">
                      <span class="material-symbols-outlined">delete</span>
                  </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    
    <footer class="transfer-footer" v-if="store.transferState">
        <div class="transfer-info">
            <span class="material-symbols-outlined">{{ store.transferState.type === 'upload' ? 'upload' : 'download' }}</span>
            <span class="transfer-filename">{{ store.transferState.filename }}</span>
            <span class="transfer-progress-text">
                {{ formatSize(store.transferState.bytesTransferred) }} / {{ formatSize(store.transferState.bytesTotal) }}
            </span>
        </div>
        <div class="transfer-bar-bg">
            <div class="transfer-bar-fill" :style="{ width: transferPercentage + '%' }"></div>
        </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useDeviceStore } from './stores/deviceStore';

const store = useDeviceStore();
const fileInput = ref(null);
const theme = ref(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const connectDisabled = ref(false);
const currentTab = ref('Stories');

const handleDisconnect = () => {
    store.disconnect();
    connectDisabled.value = true;
    setTimeout(() => {
        connectDisabled.value = false;
    }, 6000);
};

const confirmDelete = (item) => {
    if (window.confirm(`Are you sure you want to delete ${item.name}?`)) {
        store.deleteItem(item.path);
    }
};

onMounted(() => {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        theme.value = e.matches ? 'dark' : 'light';
        document.body.className = theme.value;
    });
    if (window.api && window.api.receive) {
        window.api.receive('change-theme', (newTheme) => {
            if (newTheme === 'system' || newTheme === 'os') {
                theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } else {
                theme.value = newTheme;
            }
            document.body.className = theme.value;
        });
    }
    
    // Set initial class on mount
    document.body.className = theme.value;
});

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const transferPercentage = computed(() => {
    if (!store.transferState || store.transferState.bytesTotal === 0) return 0;
    return (store.transferState.bytesTransferred / store.transferState.bytesTotal) * 100;
});

const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
        store.uploadStoryBundle(file);
    }
    // reset input
    event.target.value = '';
};

</script>

<style scoped>
.device-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background-color: var(--bg-color);
    color: var(--text-color);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.device-header {
    padding: 24px;
    background-color: var(--sidebar-bg, rgba(0,0,0,0.05));
    border-bottom: 1px solid var(--border-color);
}

.title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.title-bar h1 {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
}

.icon-large {
    font-size: 2rem;
}

.status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background-color: var(--bg-color);
    border-radius: 8px;
    border: 1px solid var(--border-color);
}

.status-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
}

.text-success {
    color: #4CAF50;
}

.storage-info {
    width: 250px;
}

.storage-text {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    margin-bottom: 4px;
    color: var(--text-color-muted, #888);
}

.storage-bar-bg {
    height: 6px;
    background-color: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
}

.storage-bar-fill {
    height: 100%;
    background-color: var(--primary-color, #2196F3);
    transition: width 0.3s ease;
}

.error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
    padding: 12px 16px;
    background-color: rgba(244, 67, 54, 0.1);
    color: #F44336;
    border-radius: 8px;
    border: 1px solid rgba(244, 67, 54, 0.3);
}

.error-banner .icon-btn {
    margin-left: auto;
    color: inherit;
}

.device-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-color-muted, #888);
    text-align: center;
}

.empty-icon {
    font-size: 4rem;
    margin-bottom: 16px;
    opacity: 0.5;
}

.section {
    margin-bottom: 32px;
    background-color: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background-color: var(--sidebar-bg, rgba(0,0,0,0.02));
    border-bottom: 1px solid var(--border-color);
}

.section-header h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 500;
}

.file-list {
    display: flex;
    flex-direction: column;
}

.empty-list {
    padding: 32px;
    text-align: center;
    color: var(--text-color-muted, #888);
    font-style: italic;
}

.file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-color);
    transition: background-color 0.2s;
}

.file-item:last-child {
    border-bottom: none;
}

.file-item:hover {
    background-color: var(--hover-color, rgba(0,0,0,0.03));
}

.file-main {
    display: flex;
    align-items: center;
    gap: 12px;
}

.file-icon {
    color: var(--text-color-muted, #888);
}

.file-meta {
    display: flex;
    align-items: center;
    gap: 16px;
}

.file-size {
    color: var(--text-color-muted, #888);
    font-size: 0.9rem;
    min-width: 60px;
    text-align: right;
}

.icon-btn {
    background: none;
    border: none;
    color: var(--text-color);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    opacity: 0.6;
}

.icon-btn:hover {
    background-color: var(--hover-color, rgba(0,0,0,0.1));
    opacity: 1;
}

.delete-btn:hover {
    color: #F44336;
    background-color: rgba(244, 67, 54, 0.1);
}

/* Tabs */
.tabs {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
}

.tab-btn {
    background: none;
    border: none;
    color: var(--text-muted, #888);
    font-size: 1.1rem;
    font-weight: 500;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
}

.tab-btn:hover {
    background-color: var(--hover-color, rgba(0,0,0,0.05));
    color: var(--text-color);
}

.tab-btn.active {
    color: var(--primary-color, #2196F3);
    background-color: var(--active-bg, rgba(33, 150, 243, 0.1));
}

/* Buttons */
button {
    font-family: inherit;
}

.primary-btn, .secondary-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: flex;
    align-items: center;
    gap: 8px;
}

.primary-btn {
    background-color: var(--primary-color, #2196F3);
    color: white;
}

.primary-btn:hover:not(:disabled) {
    filter: brightness(1.1);
}

.secondary-btn {
    background-color: var(--sidebar-bg, #eee);
    color: var(--text-color);
    border: 1px solid var(--border-color);
}

.secondary-btn:hover:not(:disabled) {
    background-color: var(--hover-color, #e0e0e0);
}

.small-btn {
    padding: 6px 12px;
    font-size: 0.9rem;
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Transfer Footer */
.transfer-footer {
    padding: 16px 24px;
    background-color: var(--sidebar-bg, rgba(0,0,0,0.05));
    border-top: 1px solid var(--border-color);
}

.transfer-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 0.9rem;
}

.transfer-filename {
    font-weight: 500;
    flex: 1;
}

.transfer-progress-text {
    font-variant-numeric: tabular-nums;
    color: var(--text-color-muted, #888);
}

.transfer-bar-bg {
    height: 8px;
    background-color: var(--border-color);
    border-radius: 4px;
    overflow: hidden;
}

.transfer-bar-fill {
    height: 100%;
    background-color: var(--primary-color, #2196F3);
    transition: width 0.1s linear;
}
</style>
