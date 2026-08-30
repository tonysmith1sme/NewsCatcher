<template>
  <div class="settings-container">
    <h2>系统配置中心</h2>

    <md-tabs class="settings-tabs" @change="onSettingsTabChange">
      <md-primary-tab>
        <span slot="icon" class="material-symbols-outlined">travel_explore</span>
        抓取
      </md-primary-tab>
      <md-primary-tab>
        <span slot="icon" class="material-symbols-outlined">smart_toy</span>
        AI
      </md-primary-tab>
      <md-primary-tab>
        <span slot="icon" class="material-symbols-outlined">filter_alt</span>
        分类
      </md-primary-tab>
      <md-primary-tab>
        <span slot="icon" class="material-symbols-outlined">notifications_active</span>
        通知
      </md-primary-tab>
      <md-primary-tab>
        <span slot="icon" class="material-symbols-outlined">folder_special</span>
        存储
      </md-primary-tab>
    </md-tabs>

    <!-- X Credentials Settings -->
    <section v-show="activeTab === 0" class="settings-section m3-card">
      <div class="section-header">
        <span class="material-symbols-outlined section-icon">account_box</span>
        <div>
          <h3>X (Twitter) Cookie 凭证设置</h3>
          <p class="section-desc">可分别填写 auth_token / ct0，也可把浏览器完整 Cookie 粘贴到任一输入框</p>
        </div>
      </div>
      <div class="form-grid">
        <md-outlined-text-field
          label="auth_token 或完整 Cookie"
          :value="form.x_auth_token"
          @input="onCookieFieldInput('x_auth_token', $event)"
          type="password"
        />
        <md-outlined-text-field
          label="ct0 (可留空，完整 Cookie 已含则可省略)"
          :value="form.x_ct0"
          @input="onCookieFieldInput('x_ct0', $event)"
          type="password"
        />
      </div>
      <div class="section-footer">
        <md-outlined-button @click="testTwitterCookie" :disabled="testingX">
          {{ testingX ? '正在连线验证...' : '测试 Cookie 有效性' }}
        </md-outlined-button>
        <span v-if="xTestResult" class="test-result" :class="{ success: xTestSuccess }">
          {{ xTestResult }}
        </span>
      </div>
    </section>

    <!-- AI Model Settings -->
    <section v-show="activeTab === 1" class="settings-section m3-card">
      <div class="section-header">
        <span class="material-symbols-outlined section-icon">smart_toy</span>
        <div>
          <h3>OpenAI 兼容 API 对接</h3>
          <p class="section-desc">对接到 OpenAI、DeepSeek、Claude 代理或本地 Ollama API 接口</p>
        </div>
      </div>
      <div class="form-grid">
        <md-outlined-text-field
          label="API Base URL"
          :value="form.ai_base_url"
          @input="form.ai_base_url = ($event.target as HTMLInputElement).value"
          supporting-text="例如: https://api.openai.com/v1 或 https://api.deepseek.com"
        />
        <md-outlined-text-field
          label="API Key"
          :value="form.ai_api_key"
          @input="form.ai_api_key = ($event.target as HTMLInputElement).value"
          type="password"
        />
        <md-outlined-text-field
          label="Model 名称"
          :value="form.ai_model"
          @input="form.ai_model = ($event.target as HTMLInputElement).value"
          supporting-text="例如: gpt-3.5-turbo, deepseek-chat, gpt-4o"
        />
      </div>
      <div class="section-footer">
        <md-outlined-button @click="testAIConnection" :disabled="testingAI">
          {{ testingAI ? '正在测试 AI 连接...' : '测试 AI 接口' }}
        </md-outlined-button>
        <span v-if="aiTestResult" class="test-result" :class="{ success: aiTestSuccess }">
          {{ aiTestResult }}
        </span>
      </div>
    </section>

    <section v-show="activeTab === 1" class="settings-section m3-card">
      <div class="section-header">
        <span class="material-symbols-outlined section-icon">psychology</span>
        <div>
          <h3>AI 提示词预设</h3>
          <p class="section-desc">保存多套人格与提示词模板，抓取时使用当前启用的一套。可用变量：{{ promptTokenHint }}</p>
        </div>
      </div>

      <div class="preset-toolbar">
        <md-outlined-select
          label="当前使用的预设"
          :value="activePresetId"
          @change="onActivePresetChange"
        >
          <md-select-option v-for="preset in promptPresets" :key="preset.id" :value="preset.id">
            <div slot="headline">{{ preset.name }}{{ preset.builtIn ? '（内置）' : '' }}</div>
          </md-select-option>
        </md-outlined-select>
        <md-outlined-button @click="openPresetEditor()">
          <span slot="icon" class="material-symbols-outlined">add</span>
          新建预设
        </md-outlined-button>
      </div>

      <div class="preset-list">
        <div v-for="preset in promptPresets" :key="preset.id" class="preset-card" :class="{ active: preset.id === activePresetId }">
          <div class="preset-card-info">
            <div class="preset-name">
              {{ preset.name }}
              <span v-if="preset.builtIn" class="preset-tag">内置</span>
              <span v-if="preset.id === activePresetId" class="preset-tag current">使用中</span>
            </div>
            <p class="preset-preview">{{ preset.systemPrompt || '（无 system 提示词）' }}</p>
          </div>
          <div class="preset-card-actions">
            <md-icon-button title="编辑" @click="openPresetEditor(preset)">
              <span class="material-symbols-outlined">edit</span>
            </md-icon-button>
            <md-icon-button title="复制" @click="duplicatePreset(preset)">
              <span class="material-symbols-outlined">content_copy</span>
            </md-icon-button>
            <md-icon-button v-if="preset.builtIn" title="恢复默认" @click="resetPreset(preset.id)">
              <span class="material-symbols-outlined">restart_alt</span>
            </md-icon-button>
            <md-icon-button v-else title="删除" class="delete-preset-btn" @click="removePreset(preset.id)">
              <span class="material-symbols-outlined">delete</span>
            </md-icon-button>
          </div>
        </div>
      </div>
    </section>

    <md-dialog :open="showPresetDialog" @closed="showPresetDialog = false" class="preset-dialog">
      <div slot="headline">{{ editingPresetId ? '编辑提示词预设' : '新建提示词预设' }}</div>
      <form slot="content" class="preset-form" @submit.prevent="savePresetEditor">
        <md-outlined-text-field
          label="预设名称"
          :value="presetDraft.name"
          @input="presetDraft.name = ($event.target as HTMLInputElement).value"
        />
        <md-outlined-text-field
          type="textarea"
          rows="4"
          label="System 提示词（人格 / 角色）"
          :value="presetDraft.systemPrompt"
          @input="presetDraft.systemPrompt = ($event.target as HTMLInputElement).value"
        />
        <div class="var-chips">
          <md-assist-chip v-for="token in promptTokens" :key="token" :label="token" @click="insertPromptToken(token)"></md-assist-chip>
        </div>
        <md-outlined-text-field
          type="textarea"
          rows="10"
          label="User 提示词模板"
          :value="presetDraft.userPromptTemplate"
          @input="onUserPromptInput"
        />
        <p class="preset-hint">请保留 JSON 输出要求，或插入 {{ jsonSchemaToken }}。若未包含该变量，后端仍会自动追加输出契约。</p>
      </form>
      <div slot="actions">
        <md-text-button @click="showPresetDialog = false">取消</md-text-button>
        <md-filled-button @click="savePresetEditor">保存预设</md-filled-button>
      </div>
    </md-dialog>

    <!-- Category Management & Retention Settings -->
    <section v-show="activeTab === 2" class="settings-section m3-card">
      <div class="section-header">
        <span class="material-symbols-outlined section-icon">filter_alt</span>
        <div>
          <h3>新闻分类全功能管理与保留设置</h3>
          <p class="section-desc">全权管理系统中的新闻分类（可任意添加新分类或删除默认分类）；勾选表示仅保留对应分类的新闻到 SQLite 数据库</p>
        </div>
      </div>

      <!-- Add Category Bar -->
      <div class="add-category-bar">
        <md-outlined-text-field
          label="添加分类名称 (如: 加密货币、芯片、硬科技)"
          :value="newCategoryName"
          @input="newCategoryName = ($event.target as HTMLInputElement).value"
          @keydown.enter.prevent="addCategory"
          class="custom-cat-input"
        />
        <md-outlined-button @click="addCategory">
          <span slot="icon" class="material-symbols-outlined">add</span>
          添加分类
        </md-outlined-button>
      </div>

      <div class="checkbox-group">
        <div v-for="cat in allCategories" :key="cat" class="checkbox-label">
          <md-checkbox
            :checked="targetCategories.includes(cat)"
            @change="toggleCategory(cat)"
            @click.stop
          />
          <span>{{ cat }}</span>
          <md-icon-button class="remove-cat-btn" @click.stop.prevent="removeCategory(cat)" title="删除该分类">
            <span class="material-symbols-outlined">close</span>
          </md-icon-button>
        </div>
      </div>
    </section>

    <!-- Scheduler Settings -->
    <section v-show="activeTab === 0" class="settings-section m3-card">
      <div class="section-header">
        <span class="material-symbols-outlined section-icon">schedule</span>
        <div>
          <h3>自动定时抓取周期设置</h3>
          <p class="section-desc">设定自动触发任务的时间间隔（支持分钟、小时、天、周）</p>
        </div>
      </div>
      <div class="scheduler-controls">
        <label class="switch-label">
          <span>启用定时自动抓取</span>
          <md-switch
            :selected="form.schedule_enabled === 'true'"
            @change="form.schedule_enabled = ($event.target as HTMLInputElement & { selected: boolean }).selected ? 'true' : 'false'"
          />
        </label>

        <div class="schedule-inputs" v-if="form.schedule_enabled === 'true'">
          <span>每</span>
          <md-outlined-text-field
            type="number"
            :value="form.schedule_value"
            @input="form.schedule_value = ($event.target as HTMLInputElement).value"
            style="width: 80px;"
          />
          <md-outlined-select
            :value="form.schedule_unit"
            @change="form.schedule_unit = ($event.target as HTMLSelectElement).value"
          >
            <md-select-option value="minutes"><div slot="headline">分钟</div></md-select-option>
            <md-select-option value="hours"><div slot="headline">小时</div></md-select-option>
            <md-select-option value="days"><div slot="headline">天</div></md-select-option>
            <md-select-option value="weeks"><div slot="headline">周</div></md-select-option>
          </md-outlined-select>
          <span>自动抓取一次</span>
        </div>
      </div>
    </section>

    <!-- Notifications Forwarding Settings -->
    <section v-show="activeTab === 3" class="settings-section m3-card">
      <div class="section-header">
        <span class="material-symbols-outlined section-icon">notifications_active</span>
        <div>
          <h3>新新闻自动通知转发设置</h3>
          <p class="section-desc">当有符合条件的新新闻收录入库时，自动推送到 Telegram、QQ 机器人 (API v2) 或自定义 Webhook</p>
        </div>
      </div>

      <!-- Telegram Bot Config -->
      <div class="notify-sub-block">
        <div class="sub-block-header">
          <label class="switch-label">
            <span>启用 Telegram Bot 通知</span>
            <md-switch
              :selected="form.notify_tg_enabled === 'true'"
              @change="form.notify_tg_enabled = ($event.target as HTMLInputElement & { selected: boolean }).selected ? 'true' : 'false'"
            />
          </label>
          <md-outlined-button v-if="form.notify_tg_enabled === 'true'" @click="testNotify('tg')">发送测试 Telegram 消息</md-outlined-button>
        </div>
        <div class="form-grid" v-if="form.notify_tg_enabled === 'true'">
          <md-outlined-text-field
            label="Telegram Bot Token (如: 123456789:ABCdef...)"
            :value="form.notify_tg_bot_token"
            @input="form.notify_tg_bot_token = ($event.target as HTMLInputElement).value"
          />
          <md-outlined-text-field
            label="Chat ID (个人 / 群组 ID)"
            :value="form.notify_tg_chat_id"
            @input="form.notify_tg_chat_id = ($event.target as HTMLInputElement).value"
          />
        </div>
      </div>

      <hr class="section-divider" />

      <!-- QQ Bot Config -->
      <div class="notify-sub-block">
        <div class="sub-block-header">
          <label class="switch-label">
            <span>启用 QQ 机器人通知 (QQ Open API v2)</span>
            <md-switch
              :selected="form.notify_qq_enabled === 'true'"
              @change="form.notify_qq_enabled = ($event.target as HTMLInputElement & { selected: boolean }).selected ? 'true' : 'false'"
            />
          </label>
          <md-outlined-button v-if="form.notify_qq_enabled === 'true'" @click="testNotify('qq')">发送测试 QQ 消息</md-outlined-button>
        </div>
        <div class="form-grid" v-if="form.notify_qq_enabled === 'true'">
          <md-outlined-text-field
            label="QQ AppID"
            :value="form.notify_qq_app_id"
            @input="form.notify_qq_app_id = ($event.target as HTMLInputElement).value"
          />
          <md-outlined-text-field
            label="ClientSecret (AppSecret)"
            :value="form.notify_qq_client_secret"
            @input="form.notify_qq_client_secret = ($event.target as HTMLInputElement).value"
            type="password"
          />
          <md-outlined-text-field
            label="子频道 ID (Channel ID - 频道推送)"
            :value="form.notify_qq_channel_id"
            @input="form.notify_qq_channel_id = ($event.target as HTMLInputElement).value"
            supporting-text="若填入 Channel ID 则优先推送到QQ频道"
          />
          <md-outlined-text-field
            label="用户/群组 OpenID (C2C 单聊或群聊 - 选填)"
            :value="form.notify_qq_openid"
            @input="form.notify_qq_openid = ($event.target as HTMLInputElement).value"
          />
        </div>
      </div>

      <hr class="section-divider" />

      <!-- Custom Webhook Config -->
      <div class="notify-sub-block">
        <div class="sub-block-header">
          <label class="switch-label">
            <span>启用自定义 Webhook (Discord / Server酱 / Bark / 企业微信)</span>
            <md-switch
              :selected="form.notify_webhook_enabled === 'true'"
              @change="form.notify_webhook_enabled = ($event.target as HTMLInputElement & { selected: boolean }).selected ? 'true' : 'false'"
            />
          </label>
          <md-outlined-button v-if="form.notify_webhook_enabled === 'true'" @click="testNotify('webhook')">发送测试 Webhook</md-outlined-button>
        </div>
        <div class="form-grid" v-if="form.notify_webhook_enabled === 'true'">
          <md-outlined-text-field
            label="Webhook URL"
            :value="form.notify_webhook_url"
            @input="form.notify_webhook_url = ($event.target as HTMLInputElement).value"
          />
        </div>
      </div>
    </section>

    <!-- Storage & Original Content Settings -->
    <section v-show="activeTab === 4" class="settings-section m3-card">
      <div class="section-header">
        <span class="material-symbols-outlined section-icon">folder_special</span>
        <div>
          <h3>新闻原文保留与图片本地存储设置</h3>
          <p class="section-desc">配置是否在生成的 Markdown 文档中附带推文原文与下载原推配图到本地存储</p>
        </div>
      </div>
      <div class="scheduler-controls">
        <label class="switch-label">
          <span>保留推文正文原文到 Markdown 报告末尾</span>
          <md-switch
            :selected="form.save_original_text === 'true'"
            @change="form.save_original_text = ($event.target as HTMLInputElement & { selected: boolean }).selected ? 'true' : 'false'"
          />
        </label>

        <label class="switch-label">
          <span>自动下载推文媒体图片并保存到本地存储目录</span>
          <md-switch
            :selected="form.save_original_images === 'true'"
            @change="form.save_original_images = ($event.target as HTMLInputElement & { selected: boolean }).selected ? 'true' : 'false'"
          />
        </label>

        <div class="form-grid" style="margin-top: 8px;">
          <md-outlined-text-field
            label="自定义图片本地存储目录路径 (绝对路径，为空则使用项目运行目录下的 /media)"
            :value="form.storage_media_dir"
            @input="form.storage_media_dir = ($event.target as HTMLInputElement).value"
            supporting-text="例如: /data/newscatcher/images 或 D:\media"
          />
        </div>
      </div>

      <hr class="section-divider" />

      <div class="section-header">
        <span class="material-symbols-outlined section-icon">key</span>
        <div>
          <h3>开放 API 访问密钥</h3>
          <p class="section-desc">第三方前端请在请求头携带 Authorization: Bearer &lt;API Key&gt;，文档见 docs/api.md</p>
        </div>
      </div>
      <md-outlined-text-field
        label="API Key"
        type="password"
        :value="apiAccessKey"
        readonly
      />
      <div class="section-footer">
        <md-outlined-button @click="copyApiKey">复制密钥</md-outlined-button>
        <md-outlined-button @click="rotateApiKey">轮换密钥</md-outlined-button>
      </div>

      <hr class="section-divider" />

      <div class="section-header">
        <span class="material-symbols-outlined section-icon">system_update</span>
        <div>
          <h3>版本与更新</h3>
          <p class="section-desc">当前版本 {{ updateInfo.currentVersion || '...' }}。二进制运行时可检查 GitHub Release 并自动下载替换程序（不会覆盖 data.db）。</p>
        </div>
      </div>
      <p class="preset-hint">{{ updateStatusText }}</p>
      <div class="section-footer">
        <md-outlined-button @click="checkUpdates" :disabled="updateBusy">
          {{ updateBusy ? '请稍候...' : '检查更新' }}
        </md-outlined-button>
        <md-filled-button v-if="updateInfo.updateAvailable" @click="applyUpdates" :disabled="updateBusy">
          立即更新到 {{ updateInfo.latestVersion }}
        </md-filled-button>
      </div>
    </section>

    <!-- Save Config Action -->
    <div class="save-bar">
      <md-filled-button class="save-btn" @click="saveAllConfigs">
        <span slot="icon" class="material-symbols-outlined">save</span>
        保存系统设置
      </md-filled-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { showSnackbar, confirmDialog } from '../composables/useFeedback';
import { PromptPreset } from '../types';
import { api, apiError, getApiKey, setApiKey } from '../api/client';

const activeTab = ref(0);

const onSettingsTabChange = (event: Event) => {
  const tabs = event.target as HTMLElement & { activeTabIndex?: number };
  activeTab.value = Number(tabs.activeTabIndex || 0);
};

const defaultCategories = ['AI', '金融', '科技', '政治', '游戏', '娱乐', '汽车', '体育', '其他'];
const allCategories = ref<string[]>([...defaultCategories]);
const newCategoryName = ref('');
const targetCategories = ref<string[]>(['AI', '金融', '科技']);

const form = ref({
  x_auth_token: '',
  x_ct0: '',
  ai_base_url: 'https://api.openai.com/v1',
  ai_api_key: '',
  ai_model: 'gpt-3.5-turbo',
  schedule_enabled: 'false',
  schedule_value: '1',
  schedule_unit: 'hours',
  notify_tg_enabled: 'false',
  notify_tg_bot_token: '',
  notify_tg_chat_id: '',
  notify_qq_enabled: 'false',
  notify_qq_app_id: '',
  notify_qq_client_secret: '',
  notify_qq_channel_id: '',
  notify_qq_openid: '',
  notify_webhook_enabled: 'false',
  notify_webhook_url: '',
  save_original_text: 'true',
  save_original_images: 'true',
  storage_media_dir: '',
});

const testingX = ref(false);
const xTestResult = ref('');
const xTestSuccess = ref(false);

const testingAI = ref(false);
const aiTestResult = ref('');
const aiTestSuccess = ref(false);

const promptTokens = ['{{authorName}}', '{{authorUsername}}', '{{createdAt}}', '{{url}}', '{{text}}', '{{categoryHint}}', '{{jsonSchema}}'];
const promptTokenHint = promptTokens.join(' ');
const jsonSchemaToken = '{{jsonSchema}}';
const promptPresets = ref<PromptPreset[]>([]);
const activePresetId = ref('');
const showPresetDialog = ref(false);
const editingPresetId = ref('');
const presetDraft = ref({
  name: '',
  systemPrompt: '',
  userPromptTemplate: '',
});
let lastUserPromptField: HTMLInputElement | null = null;

const fetchPromptPresets = async () => {
  try {
    const res = await api.get('/prompt-presets');
    promptPresets.value = res.data.data.items || [];
    activePresetId.value = res.data.data.activeId || '';
  } catch (err) {
    console.error(err);
  }
};

const onActivePresetChange = async (event: Event) => {
  const id = (event.target as HTMLSelectElement).value;
  if (!id || id === activePresetId.value) return;
  try {
    await api.post(`/prompt-presets/${id}/activate`);
    activePresetId.value = id;
    showSnackbar('已切换当前提示词预设', 'success');
  } catch (err: any) {
    showSnackbar(apiError(err) || '切换预设失败', 'error');
  }
};

const openPresetEditor = (preset?: PromptPreset) => {
  if (preset) {
    editingPresetId.value = preset.id;
    presetDraft.value = {
      name: preset.name,
      systemPrompt: preset.systemPrompt,
      userPromptTemplate: preset.userPromptTemplate,
    };
  } else {
    editingPresetId.value = '';
    const builtin = promptPresets.value.find((p) => p.builtIn);
    presetDraft.value = {
      name: '',
      systemPrompt: builtin?.systemPrompt || '你是一个严格输出 JSON 格式的新闻提炼分析助手。',
      userPromptTemplate: builtin?.userPromptTemplate || '',
    };
  }
  showPresetDialog.value = true;
};

const onUserPromptInput = (event: Event) => {
  const el = event.target as HTMLInputElement;
  lastUserPromptField = el;
  presetDraft.value.userPromptTemplate = el.value;
};

const insertPromptToken = (token: string) => {
  const current = presetDraft.value.userPromptTemplate || '';
  const el = lastUserPromptField;
  if (el && typeof el.selectionStart === 'number') {
    const start = el.selectionStart;
    const end = el.selectionEnd ?? start;
    presetDraft.value.userPromptTemplate = current.slice(0, start) + token + current.slice(end);
  } else {
    presetDraft.value.userPromptTemplate = current + token;
  }
};

const savePresetEditor = async () => {
  const name = presetDraft.value.name.trim();
  if (!name) {
    showSnackbar('请填写预设名称', 'error');
    return;
  }
  try {
    if (editingPresetId.value) {
      await api.patch(`/prompt-presets/${editingPresetId.value}`, presetDraft.value);
      showSnackbar('预设已更新', 'success');
    } else {
      await api.post('/prompt-presets', presetDraft.value);
      showSnackbar('预设已创建', 'success');
    }
    showPresetDialog.value = false;
    await fetchPromptPresets();
  } catch (err: any) {
    showSnackbar(apiError(err) || '保存预设失败', 'error');
  }
};

const duplicatePreset = async (preset: PromptPreset) => {
  try {
    await api.post('/prompt-presets', {
      name: `${preset.name} 副本`,
      systemPrompt: preset.systemPrompt,
      userPromptTemplate: preset.userPromptTemplate,
    });
    await fetchPromptPresets();
    showSnackbar('已复制预设', 'success');
  } catch (err: any) {
    showSnackbar(apiError(err) || '复制失败', 'error');
  }
};

const resetPreset = async (id: string) => {
  const ok = await confirmDialog({
    title: '恢复默认提示词',
    message: '将把内置「专业主编」恢复为系统默认文案，已做的修改会丢失。',
    confirmLabel: '恢复默认',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.post(`/prompt-presets/${id}/reset`);
    await fetchPromptPresets();
    showSnackbar('已恢复默认提示词', 'success');
  } catch (err: any) {
    showSnackbar(apiError(err) || '恢复失败', 'error');
  }
};

const removePreset = async (id: string) => {
  const ok = await confirmDialog({
    title: '删除预设',
    message: '确定删除该提示词预设吗？此操作无法撤销。',
    confirmLabel: '删除',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.delete(`/prompt-presets/${id}`);
    await fetchPromptPresets();
    showSnackbar('预设已删除', 'success');
  } catch (err: any) {
    showSnackbar(apiError(err) || '删除失败', 'error');
  }
};

const apiAccessKey = ref('');
const updateBusy = ref(false);
const updateInfo = ref({
  currentVersion: '',
  latestVersion: '',
  updateAvailable: false,
  releaseUrl: '',
  assetName: '',
  notes: '',
  packaged: false,
});
const updateStatusText = ref('尚未检查更新');

const checkUpdates = async (quiet = false) => {
  updateBusy.value = true;
  try {
    const res = await api.get('/updates');
    updateInfo.value = res.data.data || updateInfo.value;
    if (updateInfo.value.updateAvailable) {
      updateStatusText.value = `发现新版本 ${updateInfo.value.latestVersion}（当前 ${updateInfo.value.currentVersion}）`;
      if (!quiet) showSnackbar(updateStatusText.value, 'info');
    } else {
      updateStatusText.value = `已是最新版本 ${updateInfo.value.currentVersion || ''}`;
      if (!quiet) showSnackbar(updateStatusText.value, 'success');
    }
  } catch (err: any) {
    updateStatusText.value = apiError(err) || '检查更新失败';
    if (!quiet) showSnackbar(updateStatusText.value, 'error');
  } finally {
    updateBusy.value = false;
  }
};

const applyUpdates = async () => {
  const ok = await confirmDialog({
    title: '更新程序',
    message: `将下载 ${updateInfo.value.assetName || '最新安装包'} 并替换当前程序，数据库和图片不会被覆盖。完成后请重启 NewsCatcher。`,
    confirmLabel: '立即更新',
  });
  if (!ok) return;
  updateBusy.value = true;
  try {
    const res = await api.post('/updates/apply');
    const version = res.data.data?.version || updateInfo.value.latestVersion;
    showSnackbar(`已更新到 ${version}，请重启程序`, 'success', 8000);
    updateStatusText.value = `已更新到 ${version}，请重启程序`;
    updateInfo.value.updateAvailable = false;
  } catch (err: any) {
    showSnackbar(apiError(err) || '更新失败', 'error');
  } finally {
    updateBusy.value = false;
  }
};

const fetchConfig = async () => {
  try {
    const res = await api.get('/settings', { params: { reveal: 1 } });
    const data = res.data.data || {};
    form.value.x_auth_token = data.twitter?.authToken || '';
    form.value.x_ct0 = data.twitter?.ct0 || '';
    form.value.ai_base_url = data.ai?.baseUrl || form.value.ai_base_url;
    form.value.ai_api_key = data.ai?.apiKey || '';
    form.value.ai_model = data.ai?.model || form.value.ai_model;
    form.value.schedule_enabled = data.schedule?.enabled ? 'true' : 'false';
    form.value.schedule_value = String(data.schedule?.value ?? '1');
    form.value.schedule_unit = data.schedule?.unit || 'hours';
    form.value.notify_tg_enabled = data.notifications?.telegram?.enabled ? 'true' : 'false';
    form.value.notify_tg_bot_token = data.notifications?.telegram?.botToken || '';
    form.value.notify_tg_chat_id = data.notifications?.telegram?.chatId || '';
    form.value.notify_qq_enabled = data.notifications?.qq?.enabled ? 'true' : 'false';
    form.value.notify_qq_app_id = data.notifications?.qq?.appId || '';
    form.value.notify_qq_client_secret = data.notifications?.qq?.clientSecret || '';
    form.value.notify_qq_channel_id = data.notifications?.qq?.channelId || '';
    form.value.notify_qq_openid = data.notifications?.qq?.openid || '';
    form.value.notify_webhook_enabled = data.notifications?.webhook?.enabled ? 'true' : 'false';
    form.value.notify_webhook_url = data.notifications?.webhook?.url || '';
    form.value.save_original_text = data.storage?.saveOriginalText === false ? 'false' : 'true';
    form.value.save_original_images = data.storage?.saveOriginalImages === false ? 'false' : 'true';
    form.value.storage_media_dir = data.storage?.mediaDir || '';
    if (Array.isArray(data.categories?.target)) targetCategories.value = data.categories.target;
    if (Array.isArray(data.categories?.all) && data.categories.all.length > 0) {
      allCategories.value = data.categories.all;
    }
    apiAccessKey.value = data.apiKey || getApiKey();
    if (apiAccessKey.value) setApiKey(apiAccessKey.value);
  } catch (err) {
    console.error(err);
  }
};

const toggleCategory = (cat: string) => {
  const idx = targetCategories.value.indexOf(cat);
  if (idx > -1) {
    targetCategories.value.splice(idx, 1);
  } else {
    targetCategories.value.push(cat);
  }
};

const addCategory = () => {
  const val = newCategoryName.value.trim();
  if (!val) return;
  if (allCategories.value.includes(val)) {
    showSnackbar('该分类已存在', 'error');
    return;
  }
  allCategories.value.push(val);
  targetCategories.value.push(val);
  newCategoryName.value = '';
};

const removeCategory = (cat: string) => {
  if (allCategories.value.length <= 1) {
    showSnackbar('最少需保留一个分类', 'error');
    return;
  }
  const idx = allCategories.value.indexOf(cat);
  if (idx > -1) {
    allCategories.value.splice(idx, 1);
  }
  const targetIdx = targetCategories.value.indexOf(cat);
  if (targetIdx > -1) {
    targetCategories.value.splice(targetIdx, 1);
  }
};

const extractCookieValue = (raw: string, key: string): string => {
  const text = (raw || '').trim().replace(/^["']+|["']+$/g, '');
  if (!text) return '';
  for (const part of text.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === key) {
      return part.slice(eq + 1).trim().replace(/^["']+|["']+$/g, '');
    }
  }
  return '';
};

const onCookieFieldInput = (field: 'x_auth_token' | 'x_ct0', event: Event) => {
  const value = (event.target as HTMLInputElement).value || '';
  form.value[field] = value;
  const auth = extractCookieValue(value, 'auth_token');
  const ct0 = extractCookieValue(value, 'ct0');
  if (auth && field === 'x_auth_token') {
    if (!form.value.x_ct0 && ct0) form.value.x_ct0 = ct0;
  }
  if (ct0 && field === 'x_ct0' && value.includes(';')) {
    form.value.x_ct0 = ct0;
    if (!form.value.x_auth_token && auth) form.value.x_auth_token = value;
  }
};

const testTwitterCookie = async () => {
  testingX.value = true;
  xTestResult.value = '';
  try {
    const res = await api.post('/settings/twitter/test', {
      authToken: form.value.x_auth_token,
      ct0: form.value.x_ct0,
    });
    xTestSuccess.value = true;
    xTestResult.value = res.data.data?.message || '验证成功';
  } catch (err: any) {
    xTestSuccess.value = false;
    xTestResult.value = apiError(err) || '测试失败';
  } finally {
    testingX.value = false;
  }
};

const testAIConnection = async () => {
  testingAI.value = true;
  aiTestResult.value = '';
  // Save temp to test backend endpoint
  await saveAllConfigs(false);
  try {
    const res = await api.post('/settings/ai/test');
    aiTestSuccess.value = true;
    aiTestResult.value = res.data.data?.message || '连接成功';
  } catch (err: any) {
    aiTestSuccess.value = false;
    aiTestResult.value = apiError(err) || '测试连接失败';
  } finally {
    testingAI.value = false;
  }
};

const testNotify = async (type: string) => {
  await saveAllConfigs(false);
  try {
    const res = await api.post('/settings/notifications/test', { channel: type });
    showSnackbar(res.data.data?.message || '测试指令发送成功', 'success');
  } catch (err: any) {
    showSnackbar(`测试通知发送失败: ${apiError(err)}`, 'error');
  }
};

const saveAllConfigs = async (notify = true) => {
  try {
    await api.patch('/settings', {
      twitter: { authToken: form.value.x_auth_token, ct0: form.value.x_ct0 },
      ai: { baseUrl: form.value.ai_base_url, apiKey: form.value.ai_api_key, model: form.value.ai_model },
      schedule: {
        enabled: form.value.schedule_enabled === 'true',
        value: Number(form.value.schedule_value) || 1,
        unit: form.value.schedule_unit,
      },
      notifications: {
        telegram: {
          enabled: form.value.notify_tg_enabled === 'true',
          botToken: form.value.notify_tg_bot_token,
          chatId: form.value.notify_tg_chat_id,
        },
        qq: {
          enabled: form.value.notify_qq_enabled === 'true',
          appId: form.value.notify_qq_app_id,
          clientSecret: form.value.notify_qq_client_secret,
          channelId: form.value.notify_qq_channel_id,
          openid: form.value.notify_qq_openid,
        },
        webhook: {
          enabled: form.value.notify_webhook_enabled === 'true',
          url: form.value.notify_webhook_url,
        },
      },
      storage: {
        saveOriginalText: form.value.save_original_text === 'true',
        saveOriginalImages: form.value.save_original_images === 'true',
        mediaDir: form.value.storage_media_dir,
      },
      categories: { all: allCategories.value, target: targetCategories.value },
    });
    if (notify) {
      showSnackbar('所有系统设置已成功保存', 'success');
    }
  } catch (err: any) {
    showSnackbar(`保存失败: ${apiError(err)}`, 'error');
  }
};

const copyTextFallback = (text: string): boolean => {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
};

const copyApiKey = async () => {
  const text = apiAccessKey.value;
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showSnackbar('API Key 已复制', 'success');
      return;
    }
  } catch {
    // Firefox on HTTP or denied permission
  }
  if (copyTextFallback(text)) {
    showSnackbar('API Key 已复制', 'success');
    return;
  }
  showSnackbar('复制失败，请手动选择复制', 'error');
};

const rotateApiKey = async () => {
  const ok = await confirmDialog({
    title: '轮换 API Key',
    message: '旧密钥将立即失效，已对接的第三方前端需要改用新密钥。',
    confirmLabel: '轮换',
    danger: true,
  });
  if (!ok) return;
  try {
    const res = await api.post('/settings/api-key/rotate');
    const key = res.data.data?.apiKey || '';
    apiAccessKey.value = key;
    setApiKey(key);
    showSnackbar('API Key 已轮换', 'success');
  } catch (err: any) {
    showSnackbar(apiError(err) || '轮换失败', 'error');
  }
};

onMounted(() => {
  fetchConfig();
  fetchPromptPresets();
  checkUpdates(true);
});
</script>

<style scoped>
.settings-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 900px;
}

.settings-tabs {
  width: 100%;
  margin-bottom: 4px;
  --md-primary-tab-container-color: transparent;
}

.settings-section {
  background-color: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-large);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.section-icon {
  font-size: 32px;
  color: var(--md-sys-color-primary);
}

.section-desc {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 2px;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-footer {
  display: flex;
  align-items: center;
  gap: 16px;
}

.test-result {
  font-size: 13px;
  color: #c62828;
}

.test-result.success {
  color: #2e7d32;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.add-category-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.custom-cat-input {
  flex: 1;
  max-width: 400px;
}

.remove-cat-btn {
  --md-icon-button-icon-size: 16px;
  --md-icon-button-state-layer-height: 28px;
  --md-icon-button-state-layer-width: 28px;
  width: 28px;
  height: 28px;
  margin-left: 2px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
}

.scheduler-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.schedule-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.save-bar {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.switch-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 14px;
}

.notify-sub-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sub-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-divider {
  border: 0;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  margin: 12px 0;
}

.preset-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preset-toolbar md-outlined-select {
  flex: 1;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preset-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium);
  background: var(--md-sys-color-surface);
}

.preset-card.active {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
}

.preset-name {
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
}

.preset-tag.current {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.preset-preview {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preset-card-actions {
  display: flex;
  align-items: center;
}

.delete-preset-btn {
  --md-icon-button-icon-color: #b3261e;
}

.preset-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.var-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-hint {
  margin: 0;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.preset-dialog {
  max-width: min(720px, calc(100vw - 48px));
  width: min(720px, calc(100vw - 48px));
}
</style>
