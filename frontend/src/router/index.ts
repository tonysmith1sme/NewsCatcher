import { createRouter, createWebHistory } from 'vue-router';
import NewsFeedView from '../views/NewsFeedView.vue';
import SourcesView from '../views/SourcesView.vue';
import SettingsView from '../views/SettingsView.vue';
import LogsView from '../views/LogsView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'news', component: NewsFeedView },
    { path: '/sources', name: 'sources', component: SourcesView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/logs', name: 'logs', component: LogsView },
  ],
});

export default router;
