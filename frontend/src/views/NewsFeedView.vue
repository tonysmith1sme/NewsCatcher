<template>
  <div class="news-feed-container">
    <!-- Search and Category Filters Header -->
    <div class="filter-header">
      <div class="search-box">
        <md-outlined-text-field
          label="搜索新闻标题、内容或推主..."
          :value="searchQuery"
          @input="onSearchInput"
          class="search-input"
        >
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-outlined-text-field>
      </div>

      <div class="category-chips">
        <md-chip-set>
          <md-filter-chip
            v-for="cat in categories"
            :key="cat"
            :label="cat"
            :selected="selectedCategory === cat"
            @click="selectCategory(cat)"
          />
        </md-chip-set>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <md-circular-progress indeterminate></md-circular-progress>
      <span>加载最新抓取的新闻...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="newsList.length === 0" class="empty-state">
      <span class="material-symbols-outlined empty-icon">feed</span>
      <h3>暂无符合条件的新闻</h3>
      <p>点击右上方“立即抓取新闻”或在“抓取源管理”中添加更多搜索关键字/账号</p>
    </div>

    <!-- News Grid Cards -->
    <div v-else class="news-grid">
      <div v-for="item in newsList" :key="item.id" class="m3-card news-card" @click="openReader(item)">
        <div class="card-header">
          <span class="category-tag">{{ item.category }}</span>
          <span class="importance-stars">
            <span v-for="n in item.importance" :key="n" class="material-symbols-outlined star-icon">star</span>
          </span>
        </div>

        <h2 class="news-title">{{ item.title }}</h2>
        <p class="news-summary">{{ item.summary }}</p>

        <div class="card-footer">
          <div class="author-info">
            <span class="material-symbols-outlined">account_circle</span>
            <span>{{ item.author }}</span>
          </div>
          <span class="time-ago">{{ formatDate(item.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <md-outlined-button :disabled="page <= 1" @click="changePage(page - 1)">上一页</md-outlined-button>
      <span class="page-info">第 {{ page }} 页 / 共 {{ Math.ceil(total / limit) }} 页</span>
      <md-outlined-button :disabled="page >= Math.ceil(total / limit)" @click="changePage(page + 1)">下一页</md-outlined-button>
    </div>

    <!-- M3 Markdown Article Drawer/Dialog -->
    <md-dialog :open="!!activeNews" @closed="activeNews = null" class="markdown-dialog">
      <div slot="headline" class="dialog-headline">
        <span class="dialog-category">{{ activeNews?.category }}</span>
        <h2 class="dialog-title">{{ activeNews?.title }}</h2>
      </div>

      <div slot="content" class="dialog-content">
        <div class="dialog-meta">
          <span>原作者: {{ activeNews?.author }} (@{{ activeNews?.authorUsername }})</span>
          <span>抓取时间: {{ activeNews ? formatDate(activeNews.createdAt) : '' }}</span>
          <a :href="activeNews?.originalUrl" target="_blank" class="x-link">
            在 X 上查看原推 <span class="material-symbols-outlined">open_in_new</span>
          </a>
        </div>
        <hr class="divider" />
        <div class="markdown-body" v-html="renderedMarkdown"></div>
      </div>

      <div slot="actions">
        <md-outlined-button @click="deleteNews(activeNews?.id)" class="delete-btn">
          <span slot="icon" class="material-symbols-outlined">delete</span>
          删除该条
        </md-outlined-button>
        <md-filled-button @click="activeNews = null">关闭</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { marked } from 'marked';
import { NewsItem } from '../types';

const defaultCategories = ['ALL', 'AI', '金融', '科技', '政治', '游戏', '娱乐', '其他'];
const customCategories = ref<string[]>([]);
const selectedCategory = ref('ALL');

const categories = computed(() => {
  const list = [...defaultCategories];
  for (const c of customCategories.value) {
    if (!list.includes(c)) {
      list.push(c);
    }
  }
  return list;
});
const searchQuery = ref('');
const newsList = ref<NewsItem[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(9);
const loading = ref(false);
const activeNews = ref<NewsItem | null>(null);

let debounceTimer: any = null;

const fetchNews = async () => {
  loading.value = true;
  try {
    const [newsRes, configRes] = await Promise.all([
      axios.get('/api/news', {
        params: {
          category: selectedCategory.value,
          search: searchQuery.value,
          page: page.value,
          limit: limit.value,
        },
      }),
      axios.get('/api/config'),
    ]);
    newsList.value = newsRes.data.data;
    total.value = newsRes.data.total;
    if (configRes.data.data?.custom_categories) {
      try {
        customCategories.value = JSON.parse(configRes.data.data.custom_categories);
      } catch (e) {}
    }
  } catch (err: any) {
    console.error('Fetch news error:', err);
  } finally {
    loading.value = false;
  }
};

const onSearchInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  searchQuery.value = val;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page.value = 1;
    fetchNews();
  }, 400);
};

const selectCategory = (cat: string) => {
  selectedCategory.value = cat;
  page.value = 1;
  fetchNews();
};

const changePage = (newPage: number) => {
  page.value = newPage;
  fetchNews();
};

const openReader = (item: NewsItem) => {
  activeNews.value = item;
};

const renderedMarkdown = computed(() => {
  if (!activeNews.value) return '';
  return marked.parse(activeNews.value.markdownContent);
});

const deleteNews = async (id?: string) => {
  if (!id) return;
  if (!confirm('确定要删除这条新闻吗？')) return;
  try {
    await axios.delete(`/api/news/${id}`);
    activeNews.value = null;
    fetchNews();
  } catch (err: any) {
    alert('删除失败');
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const handleRefreshEvent = () => fetchNews();

onMounted(() => {
  fetchNews();
  window.addEventListener('refresh-news', handleRefreshEvent);
});

onUnmounted(() => {
  window.removeEventListener('refresh-news', handleRefreshEvent);
});
</script>

<style scoped>
.news-feed-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filter-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-input {
  width: 100%;
  max-width: 600px;
}

.category-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 16px;
  color: var(--md-sys-color-on-surface-variant);
}

.empty-icon {
  font-size: 64px;
  color: var(--md-sys-color-outline);
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.news-card {
  background-color: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-large);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.news-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: var(--md-sys-color-primary);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-tag {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}

.importance-stars {
  display: flex;
  gap: 2px;
  color: #f59e0b;
}

.star-icon {
  font-size: 16px;
}

.news-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin: 0;
  line-height: 1.4;
}

.news-summary {
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  font-size: 12px;
  color: var(--md-sys-color-outline);
}

.author-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.markdown-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface);
  width: 90vw;
  max-width: 800px;
}

.dialog-headline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dialog-category {
  font-size: 12px;
  color: var(--md-sys-color-primary);
  font-weight: 700;
}

.dialog-title {
  font-size: 22px;
  margin: 0;
}

.dialog-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  margin-bottom: 12px;
}

.x-link {
  color: var(--md-sys-color-primary);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.divider {
  border: 0;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  margin: 16px 0;
}

.delete-btn {
  --md-outlined-button-label-text-color: #c62828;
}
</style>
