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
        <!-- Execution Alert Toast -->
        <div v-if="taskMessage" class="m3-toast" :class="taskStatus">
          <span class="material-symbols-outlined">info</span>
          <span>{{ taskMessage }}</span>
        </div>

        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

const isRunning = ref(false);
const taskMessage = ref('');
const taskStatus = ref<'success' | 'error'>('success');

const triggerFetchTask = async () => {
  if (isRunning.value) return;
  isRunning.value = true;
  taskMessage.value = '正在连线 X 接口并调用 AI 总结过滤中，请稍候...';
  taskStatus.value = 'success';

  try {
    const res = await axios.post('/api/task/run');
    if (res.data.success) {
      taskMessage.value = res.data.logMessage || '手动抓取与 AI 提炼任务执行完毕！';
      // Trigger custom window event so child views can refresh
      window.dispatchEvent(new CustomEvent('refresh-news'));
    } else {
      taskMessage.value = `执行失败: ${res.data.message}`;
      taskStatus.value = 'error';
    }
  } catch (err: any) {
    taskMessage.value = `抓取任务异常: ${err.response?.data?.message || err.message}`;
    taskStatus.value = 'error';
  } finally {
    isRunning.value = false;
    setTimeout(() => {
      taskMessage.value = '';
    }, 6000);
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

.m3-toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-radius: var(--md-sys-shape-corner-medium);
  margin-bottom: 16px;
  font-size: 14px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.m3-toast.success {
  background-color: #e8f5e9;
  color: #1b5e20;
}

.m3-toast.error {
  background-color: #ffebee;
  color: #c62828;
}
</style>
