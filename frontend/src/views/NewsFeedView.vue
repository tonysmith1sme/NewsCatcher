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
        <div class="category-chip-list">
          <button
            v-for="cat in categories"
            :key="cat"
            class="m3-category-chip"
            :class="{ active: selectedCategory === cat }"
            @click="selectCategory(cat)"
          >
            {{ cat }}
          </button>
        </div>
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
    <md-dialog v-if="!!activeNews" :open="!!activeNews" @closed="activeNews = null" class="markdown-dialog">
      <div slot="headline" class="dialog-headline">
        <div class="headline-top">
          <span class="dialog-category">{{ activeNews?.category }}</span>
          <!-- Tab Bar: Report vs Original Tweet -->
          <div class="dialog-tabs">
            <button
              class="tab-btn"
              :class="{ active: dialogTab === 'report' }"
              @click="dialogTab = 'report'"
            >
              <span class="material-symbols-outlined tab-icon">description</span>
              新闻报告
            </button>
            <button
              class="tab-btn"
              :class="{ active: dialogTab === 'raw' }"
              @click="dialogTab = 'raw'"
            >
              <span class="material-symbols-outlined tab-icon">article</span>
              推文原文
            </button>
          </div>
        </div>
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

        <!-- Tab 1: AI Report -->
        <div v-if="dialogTab === 'report'" class="markdown-body" v-html="renderedMarkdown"></div>

        <!-- Tab 2: Raw Tweet Content -->
        <div v-else-if="dialogTab === 'raw'" class="raw-content-view">
          <div class="raw-author-card">
            <span class="material-symbols-outlined author-avatar">account_circle</span>
            <div>
              <div class="raw-author-name">{{ activeNews?.raw?.authorName || activeNews?.author }}</div>
              <div class="raw-author-handle">@{{ activeNews?.raw?.authorUsername || activeNews?.authorUsername }}</div>
            </div>
          </div>

          <div class="raw-text-box">
            {{ activeNews?.raw?.rawText || '暂未收录该推文原文数据' }}
          </div>

          <!-- Media Images Gallery -->
          <div v-if="rawMediaUrls.length > 0" class="raw-media-gallery">
            <h3>📷 推文原图列表 ({{ rawMediaUrls.length }})</h3>
            <div class="media-grid">
              <a v-for="(imgUrl, idx) in rawMediaUrls" :key="idx" :href="imgUrl" target="_blank" class="media-item">
                <img :src="imgUrl" :alt="`推文图片 ${idx + 1}`" loading="lazy" />
              </a>
            </div>
          </div>
        </div>
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
const categories = ref<string[]>([...defaultCategories]);
const selectedCategory = ref('ALL');
const searchQuery = ref('');
const newsList = ref<NewsItem[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(9);
const loading = ref(false);
const activeNews = ref<NewsItem | null>(null);
const dialogTab = ref<'report' | 'raw'>('report');

let debounceTimer: any = null;

const fetchNews = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/news', {
      params: {
        category: selectedCategory.value,
        search: searchQuery.value,
        page: page.value,
        limit: limit.value,
      },
    });
    newsList.value = res.data.data;
    total.value = res.data.total;
  } catch (err: any) {
    console.error('Fetch news error:', err);
  } finally {
    loading.value = false;
  }
};

const fetchCategories = async () => {
  try {
    const configRes = await axios.get('/api/config');
    if (configRes.data.data?.all_categories) {
      try {
        const configured = JSON.parse(configRes.data.data.all_categories);
        categories.value = ['ALL', ...configured];
      } catch (e) {}
    } else if (configRes.data.data?.custom_categories) {
      try {
        const custom = JSON.parse(configRes.data.data.custom_categories);
        categories.value = ['ALL', ...Array.from(new Set(['AI', '金融', '科技', '政治', '游戏', '娱乐', '汽车', '体育', '其他', ...custom]))];
      } catch (e) {}
    }
  } catch (e) {
    console.error('Fetch categories error:', e);
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
  if (selectedCategory.value === cat) return;
  selectedCategory.value = cat;
  page.value = 1;
  fetchNews();
};

const changePage = (newPage: number) => {
  page.value = newPage;
  fetchNews();
};

const openReader = async (item: NewsItem) => {
  dialogTab.value = 'report';
  activeNews.value = item;
  try {
    const res = await axios.get(`/api/news/${item.id}`);
    if (res.data.data) {
      activeNews.value = res.data.data;
    }
  } catch (e) {
    console.error('Fetch news detail error:', e);
  }
};

const renderedMarkdown = computed(() => {
  if (!activeNews.value) return '';
  return marked.parse(activeNews.value.markdownContent);
});

const rawMediaUrls = computed<string[]>(() => {
  if (!activeNews.value) return [];
  const jsonStr = activeNews.value.raw?.mediaUrlsJson || activeNews.value.mediaUrlsJson;
  if (!jsonStr) return [];
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return [];
  }
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
  fetchCategories();
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
  padding-bottom: 4px;
}

.category-chip-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.m3-category-chip {
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.m3-category-chip:hover {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.m3-category-chip.active {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
  font-weight: 700;
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
  gap: 10px;
}

.headline-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-tabs {
  display: flex;
  gap: 8px;
  background-color: var(--md-sys-color-surface-variant);
  padding: 4px;
  border-radius: 20px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-primary);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.tab-icon {
  font-size: 16px;
}

.raw-content-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.raw-author-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--md-sys-color-surface-variant);
  border-radius: var(--md-sys-shape-corner-medium);
}

.author-avatar {
  font-size: 36px;
  color: var(--md-sys-color-primary);
}

.raw-author-name {
  font-weight: 700;
  font-size: 15px;
}

.raw-author-handle {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.raw-text-box {
  background-color: #fcfcfc;
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 16px;
  border-radius: var(--md-sys-shape-corner-medium);
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.raw-media-gallery h3 {
  font-size: 14px;
  margin-bottom: 12px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.media-item img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--md-sys-color-outline-variant);
  transition: transform 0.2s ease;
}

.media-item img:hover {
  transform: scale(1.03);
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
