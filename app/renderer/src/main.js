import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

if (window.api && window.api.platform === 'darwin') {
  document.body.classList.add('is-mac')
}
