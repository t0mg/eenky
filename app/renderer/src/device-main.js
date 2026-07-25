import { createApp } from 'vue';
import { createPinia } from 'pinia';
import DeviceApp from './DeviceApp.vue';
import './style.css';

const app = createApp(DeviceApp);
app.use(createPinia());
app.mount('#app');
