<template>
  <div class="sources-container">
    <div class="header-action">
      <div>
        <h2>X 抓取源配置</h2>
        <p class="subtitle">设置想要监控抓取的 Twitter 搜索关键词、Hashtag 话题或指定推主账号</p>
      </div>
      <md-filled-button @click="showAddDialog = true">
        <span slot="icon" class="material-symbols-outlined">add</span>
        添加抓取源
      </md-filled-button>
    </div>

    <!-- Sources Table / List -->
    <div class="sources-list">
      <div v-for="src in sources" :key="src.id" class="m3-card source-card">
        <div class="source-info">
          <div class="source-header">
            <span class="source-name">{{ src.name }}</span>
            <span class="type-badge" :class="src.type">{{ getTypeLabel(src.type) }}</span>
          </div>
          <code class="source-query">{{ src.query }}</code>
        </div>

        <div class="source-actions">
          <label class="switch-label">
            <span>{{ src.enabled ? '已启用' : '已禁用' }}</span>
            <md-switch :selected="src.enabled" @change="toggleSource(src.id)"></md-switch>
          </label>
          <md-icon-button @click="deleteSource(src.id)">
            <span class="material-symbols-outlined delete-icon">delete</span>
          </md-icon-button>
        </div>
      </div>
    </div>

    <!-- Add Source Dialog -->
    <md-dialog :open="showAddDialog" @closed="showAddDialog = false">
      <div slot="headline">添加新的 X 抓取源</div>
      <form slot="content" class="add-form" @submit.prevent="saveSource">
        <md-outlined-text-field
          label="抓取源名称 (如：OpenAI 官方账号)"
          :value="newSource.name"
          @input="newSource.name = ($event.target as HTMLInputElement).value"
          required
        />
        <md-outlined-select
          label="类型"
          :value="newSource.type"
          @change="newSource.type = ($event.target as HTMLSelectElement).value"
        >
          <md-select-option value="search">
            <div slot="headline">关键词搜索 (Search)</div>
          </md-select-option>
          <md-select-option value="user">
            <div slot="headline">指定推主账号 (from:username)</div>
          </md-select-option>
          <md-select-option value="hashtag">
            <div slot="headline">Hashtag 话题 (#topic)</div>
          </md-select-option>
        </md-outlined-select>

        <md-outlined-text-field
          label="查询表达式 (如: from:OpenAI min_faves:50 或 #AI)"
          :value="newSource.query"
          @input="newSource.query = ($event.target as HTMLInputElement).value"
          supporting-text="支持标准的 X Search 表达式语法"
          required
        />
      </form>

      <div slot="actions">
        <md-outlined-button @click="showAddDialog = false">取消</md-outlined-button>
        <md-filled-button @click="saveSource">保存源</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { SourceItem } from '../types';

const sources = ref<SourceItem[]>([]);
const showAddDialog = ref(false);
const newSource = ref({
  name: '',
  type: 'search',
  query: '',
});

const fetchSources = async () => {
  try {
    const res = await axios.get('/api/sources');
    sources.value = res.data.data;
  } catch (err) {
    console.error(err);
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'user': return '推主';
    case 'hashtag': return '话题';
    default: return '搜索';
  }
};

const toggleSource = async (id: string) => {
  try {
    await axios.patch(`/api/sources/${id}/toggle`);
    fetchSources();
  } catch (err) {
    alert('切换状态失败');
  }
};

const deleteSource = async (id: string) => {
  if (!confirm('确定删除该抓取源吗？')) return;
  try {
    await axios.delete(`/api/sources/${id}`);
    fetchSources();
  } catch (err) {
    alert('删除失败');
  }
};

const saveSource = async () => {
  if (!newSource.value.name || !newSource.value.query) {
    alert('请填写完整信息');
    return;
  }
  try {
    await axios.post('/api/sources', newSource.value);
    showAddDialog.value = false;
    newSource.value = { name: '', type: 'search', query: '' };
    fetchSources();
  } catch (err: any) {
    alert(`添加失败: ${err.response?.data?.message || err.message}`);
  }
};

onMounted(() => {
  fetchSources();
});
</script>

<style scoped>
.sources-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subtitle {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 14px;
  margin-top: 4px;
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.source-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium);
}

.source-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.source-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.source-name {
  font-weight: 700;
  font-size: 16px;
}

.type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: #e0e0e0;
}

.type-badge.user { background-color: #e3f2fd; color: #1565c0; }
.type-badge.hashtag { background-color: #f3e5f5; color: #7b1fa2; }
.type-badge.search { background-color: #e8f5e9; color: #2e7d32; }

.source-query {
  background-color: var(--md-sys-color-surface-variant);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.delete-icon {
  color: #c62828;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px 8px;
  min-width: 420px;
}
</style>
