<template>
  <div class="settings-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Ayarlar</h1>
        <p class="page-subtitle">Uygulamayı kişiselleştirin</p>
      </div>
    </div>

    <!-- Settings Sections -->
    <div class="settings-content">
      <!-- Genel Ayarlar -->
      <div class="settings-section">
        <h2 class="section-title">Genel</h2>

        <div class="settings-items">
          <div class="setting-item">
            <div class="setting-label">
              <label>Dil</label>
            </div>
            <select v-model="settingsStore.language" class="setting-input">
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>Tema</label>
            </div>
            <select v-model="settingsStore.theme" class="setting-input">
              <option value="dark">Koyu</option>
              <option value="light" disabled>Açık (Yakında)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>Varsayılan Program</label>
            </div>
            <select v-model="settingsStore.defaultProgram" class="setting-input">
              <option value="sap2000">SAP2000</option>
              <option value="etabs">ETABS</option>
              <option value="risa3d">RISA-3D</option>
              <option value="staadpro">STAAD Pro</option>
            </select>
          </div>
        </div>
      </div>

      <!-- AI Ayarları -->
      <div class="settings-section">
        <h2 class="section-title">AI Ayarları</h2>

        <div class="settings-items">
          <div class="setting-item">
            <div class="setting-label">
              <label>Model</label>
            </div>
            <select v-model="chatStore.model" class="setting-input">
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-haiku-4">Claude Haiku 4</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>API Key</label>
              <span class="setting-help">Güvenli bir şekilde saklanır</span>
            </div>
            <div class="input-group">
              <input
                v-model="settingsStore.apiKey"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="sk-ant-..."
                class="setting-input"
              />
              <button @click="showApiKey = !showApiKey" class="input-addon">
                <Icon :name="showApiKey ? 'lucide:eye-off' : 'lucide:eye'" />
              </button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>Yönetmelikler</label>
              <span class="setting-help">AI'ın uyması gereken standartlar</span>
            </div>
            <div class="checkbox-grid">
              <label class="checkbox-item">
                <input
                  type="checkbox"
                  :checked="settingsStore.regulations.includes('tbdy2018')"
                  @change="settingsStore.toggleRegulation('tbdy2018')"
                />
                <span>TBDY 2018</span>
              </label>
              <label class="checkbox-item">
                <input
                  type="checkbox"
                  :checked="settingsStore.regulations.includes('asce7-22')"
                  @change="settingsStore.toggleRegulation('asce7-22')"
                />
                <span>ASCE 7-22</span>
              </label>
              <label class="checkbox-item">
                <input
                  type="checkbox"
                  :checked="settingsStore.regulations.includes('eurocode8')"
                  @change="settingsStore.toggleRegulation('eurocode8')"
                />
                <span>Eurocode 8</span>
              </label>
              <label class="checkbox-item">
                <input
                  type="checkbox"
                  :checked="settingsStore.regulations.includes('aci318')"
                  @change="settingsStore.toggleRegulation('aci318')"
                />
                <span>ACI 318</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Local Agent -->
      <div class="settings-section">
        <h2 class="section-title">Local Agent</h2>

        <div class="settings-items">
          <div class="setting-item">
            <div class="setting-label">
              <label>Durum</label>
              <span class="setting-help">
                StructAI Agent uygulaması ile bağlantı durumu
              </span>
            </div>
            <div class="agent-status-display">
              <span
                class="status-dot"
                :class="agent.connected.value ? 'connected' : 'disconnected'"
              />
              <span class="status-text">
                {{ agent.connected.value ? 'Bağlı' : 'Bağlı değil' }}
              </span>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>İzlenen Klasör</label>
              <span class="setting-help">
                Klasörü değiştirmek için Agent uygulamasını kullanın
              </span>
            </div>
            <div class="agent-root-display">
              {{ agent.root.value || '(seçilmedi)' }}
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>Dosya Sayısı</label>
            </div>
            <div class="agent-root-display">
              {{ agent.fileCount.value }}
            </div>
          </div>
        </div>
      </div>

      <!-- Editör Ayarları -->
      <div class="settings-section">
        <h2 class="section-title">Editör</h2>

        <div class="settings-items">
          <div class="setting-item">
            <div class="setting-label">
              <label>Satır Numaraları</label>
            </div>
            <label class="toggle-switch">
              <input v-model="settingsStore.showLineNumbers" type="checkbox" />
              <span class="toggle-slider" />
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>Minimap</label>
            </div>
            <label class="toggle-switch">
              <input v-model="settingsStore.enableMinimap" type="checkbox" />
              <span class="toggle-slider" />
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>Otomatik Kaydetme</label>
            </div>
            <label class="toggle-switch">
              <input v-model="settingsStore.autoSave" type="checkbox" />
              <span class="toggle-slider" />
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>Yazı Boyutu</label>
              <span class="setting-value">{{ settingsStore.fontSize }}px</span>
            </div>
            <input
              v-model.number="settingsStore.fontSize"
              type="range"
              min="10"
              max="20"
              class="range-slider"
            />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label>Tab Boyutu</label>
            </div>
            <select v-model.number="settingsStore.tabSize" class="setting-input">
              <option :value="2">2 boşluk</option>
              <option :value="4">4 boşluk</option>
              <option :value="8">8 boşluk</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="settings-actions">
        <button @click="handleSave" class="btn btn-primary">
          <Icon name="lucide:save" />
          Değişiklikleri Kaydet
        </button>
        <button @click="handleReset" class="btn btn-secondary">
          <Icon name="lucide:rotate-ccw" />
          Sıfırla
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '~/stores/settings'
import { useChatStore } from '~/stores/chat'
import { useAgent } from '~/composables/useAgent'

definePageMeta({
  layout: 'default',
})

useSeoMeta({
  title: 'Ayarlar - StructAI',
  description: 'Uygulama ayarlarını yönetin',
})

const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const agent = useAgent()

const showApiKey = ref(false)

onMounted(() => {
  settingsStore.loadFromStorage()
})

const handleSave = () => {
  settingsStore.saveToStorage()
  console.log('Ayarlar kaydedildi')
}

const handleReset = () => {
  if (confirm('Tüm ayarları sıfırlamak istediğinizden emin misiniz?')) {
    settingsStore.resetToDefaults()
  }
}
</script>

<style scoped>
.settings-page {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

/* Header */
.page-header {
  margin-bottom: 2.5rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
}

/* Settings Content */
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Section */
.settings-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 1.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-default);
}

/* Settings Items */
.settings-items {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.setting-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.setting-label label {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-help {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.setting-value {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}

.setting-input {
  width: 240px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: all 0.2s;
}

.setting-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

/* Input Group */
.input-group {
  display: flex;
  width: 240px;
}

.input-group .setting-input {
  flex: 1;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}

.input-addon {
  width: 40px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.input-addon:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

/* Checkbox Grid */
.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  width: 240px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.checkbox-item:hover {
  background: var(--bg-elevated);
  border-color: var(--accent-blue);
}

.checkbox-item input[type="checkbox"] {
  cursor: pointer;
  accent-color: var(--accent-blue);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--accent-blue);
  border-color: var(--accent-blue);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* Range Slider */
.range-slider {
  width: 240px;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary);
  outline: none;
  -webkit-appearance: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-blue);
  cursor: pointer;
  border: 2px solid var(--bg-secondary);
}

.range-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-blue);
  cursor: pointer;
  border: 2px solid var(--bg-secondary);
}

/* Agent Status Display */
.agent-status-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-green);
}

.status-dot.connecting {
  background: var(--accent-amber);
}

.status-dot.disconnected {
  background: var(--accent-red);
}

.status-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Button Group */
.button-group {
  display: flex;
  gap: 0.75rem;
}

/* Actions */
.settings-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
}

/* Responsive */
@media (max-width: 768px) {
  .settings-page {
    padding: 1rem;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .setting-input,
  .input-group,
  .checkbox-grid,
  .range-slider {
    width: 100%;
  }

  .checkbox-grid {
    grid-template-columns: 1fr;
  }
}
</style>
