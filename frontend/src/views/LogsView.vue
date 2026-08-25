<template>
  <div class="logs-container">
    <div class="logs-header">
      <h2>抓取与 AI 处理任务日志</h2>
      <md-outlined-button @click="fetchLogs">
        <span slot="icon" class="material-symbols-outlined">refresh</span>
        刷新日志
      </md-outlined-button>
    </div>

    <!-- Logs Table -->
    <div class="logs-card m3-card">
      <table class="logs-table">
        <thead>
          <tr>
            <th>触发时间</th>
            <th>状态</th>
            <th>抓取推文数</th>
            <th>保存新闻数</th>
            <th>详细信息</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="logs.length === 0">
            <td colspan="5" class="empty-td">暂无抓取任务运行记录</td>
          </tr>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ formatDate(log.createdAt) }}</td>
            <td>
              <span class="status-badge" :class="log.status">{{ getStatusLabel(log.status) }}</span>
            </td>
            <td>{{ log.fetchedCount }}</td>
            <td>{{ log.savedCount }}</td>
            <td class="msg-td">{{ log.message }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { LogItem } from '../types';
import { api } from '../api/client';

const logs = ref<LogItem[]>([]);

const fetchLogs = async () => {
  try {
    const res = await api.get('/jobs');
    logs.value = res.data.data;
  } catch (err) {
    console.error(err);
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'SUCCESS': return '成功';
    case 'FAILED': return '失败';
    case 'IN_PROGRESS': return '进行中';
    default: return status;
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN');
};

onMounted(() => {
  fetchLogs();
});
</script>

<style scoped>
.logs-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logs-card {
  background-color: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-large);
  overflow: hidden;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 14px;
}

.logs-table th, .logs-table td {
  padding: 14px 20px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.logs-table th {
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
  font-weight: 600;
}

.empty-td {
  text-align: center;
  color: var(--md-sys-color-outline);
  padding: 40px 0;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}

.status-badge.SUCCESS {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.status-badge.FAILED {
  background-color: #ffebee;
  color: #c62828;
}

.status-badge.IN_PROGRESS {
  background-color: #e3f2fd;
  color: #1565c0;
}

.msg-td {
  color: var(--md-sys-color-on-surface-variant);
}
</style>
