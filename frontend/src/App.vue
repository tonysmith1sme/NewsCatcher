<template>
  <div class="m3-app-layout">
    <!-- M3 Top App Bar -->
    <header class="m3-top-app-bar">
      <div class="app-bar-brand">
        <span class="material-symbols-outlined logo-icon">newspaper</span>
        <span class="app-title">NewsCatcher</span>
        <span class="app-subtitle">X (Twitter) 智能抓取与提炼</span>
      </div>
      <div class="app-bar-actions">
        <md-filled-button class="run-btn" :disabled="isRunning" @click="triggerFetchTask">
          <span slot="icon" class="material-symbols-outlined">bolt</span>
          {{ isRunning ? '抓取中...' : '立即抓取新闻' }}
        </md-filled-button>
      </div>
    </header>

    <div class="main-container">
      <!-- M3 Navigation Rail / Sidebar -->
      <nav class="m3-nav-rail">
        <router-link to="/" class="nav-item" active-class="active">
          <span class="material-symbols-outlined nav-icon">rss_feed</span>
          <span class="nav-label">新闻简报</span>
        </router-link>
        <router-link to="/sources" class="nav-item" active-class="active">
          <span class="material-symbols-outlined nav-icon">manage_search</span>
          <span class="nav-label">抓取源管理</span>
        </router-link>
        <router-link to="/settings" class="nav-item" active-class="active">
          <span class="material-symbols-outlined nav-icon">settings</span>
          <span class="nav-label">系统设置</span>
        </router-link>
        <router-link to="/logs" class="nav-item" active-class="active">
          <span class="material-symbols-outlined nav-icon">article</span>
          <span class="nav-label">抓取日志</span>
        </router-link>
      </nav>

      <!-- Main Content View -->
      <main class="m3-content-area">
        <router-view />
      </main>
    </div>

    <FeedbackHost />

    <md-dialog :open="showKeyDialog" @closed="showKeyDialog = false">
      <div slot="headline">输入 API Key</div>
      <div slot="content" class="api-key-dialog">
        <p>API 已初始化。请粘贴访问密钥后继续使用（也可在系统设置 → 存储中查看或轮换）。</p>
        <md-outlined-text-field
          label="API Key"
          type="password"
          :value="apiKeyInput"
          @input="apiKeyInput = ($event.target as HTMLInputElement).value"
        />
      </div>
      <div slot="actions">
        <md-text-button @click="showKeyDialog = false">取消</md-text-button>
        <md-filled-button @click="saveApiKeyInput">保存</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import FeedbackHost from './components/FeedbackHost.vue';
import { showSnackbar } from './composables/useFeedback';
import { api, apiError, ensureApiKey, setApiKey } from './api/client';

const isRunning = ref(false);
const showKeyDialog = ref(false);
const apiKeyInput = ref('');

onMounted(async () => {
  const ok = await ensureApiKey();
  if (!ok) showKeyDialog.value = true;
});

const saveApiKeyInput = () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showSnackbar('请输入 API Key', 'error');
    return;
  }
  setApiKey(key);
  showKeyDialog.value = false;
  showSnackbar('API Key 已保存', 'success');
};

const triggerFetchTask = async () => {
  if (isRunning.value) return;
  isRunning.value = true;
  showSnackbar('正在连线 X 接口并调用 AI 总结过滤中，请稍候...', 'info', 8000);

  try {
    const res = await api.post('/jobs', { type: 'fetch' });
    showSnackbar(res.data.data?.logMessage || '手动抓取与 AI 提炼任务执行完毕！', 'success', 6000);
    window.dispatchEvent(new CustomEvent('refresh-news'));
  } catch (err: any) {
    showSnackbar(`抓取任务异常: ${apiError(err)}`, 'error', 6000);
  } finally {
    isRunning.value = false;
  }
};
</script>

<style scoped>
.m3-app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--md-sys-color-background);
}

.m3-top-app-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  background-color: var(--md-sys-color-surface-variant);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.app-bar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 28px;
  color: var(--md-sys-color-primary);
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.app-subtitle {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  margin-left: 8px;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.m3-nav-rail {
  width: 220px;
  background-color: var(--md-sys-color-surface);
  border-right: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: var(--md-sys-shape-corner-extra-large);
  color: var(--md-sys-color-on-surface-variant);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background-color: rgba(103, 80, 164, 0.08);
  color: var(--md-sys-color-primary);
}

.nav-item.active {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-weight: 700;
}

.m3-content-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  position: relative;
}

.api-key-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 420px;
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
