<template>
  <div class="settings-container">
    <h2>系统配置中心</h2>

    <!-- X Credentials Settings -->
    <section class="settings-section m3-card">
      <div class="section-header">
        <span class="material-symbols-outlined section-icon">account_box</span>
        <div>
          <h3>X (Twitter) Cookie 凭证设置</h3>
          <p class="section-desc">全自动登录抓取推文所需的 Cookie 验证凭证</p>
        </div>
      </div>
      <div class="form-grid">
        <md-outlined-text-field
          label="auth_token Cookie 值"
          :value="form.x_auth_token"
          @input="form.x_auth_token = ($event.target as HTMLInputElement).value"
          type="password"
        />
        <md-outlined-text-field
          label="ct0 (CSRF Token) Cookie 值"
          :value="form.x_ct0"
          @input="form.x_ct0 = ($event.target as HTMLInputElement).value"
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
    <section class="settings-section m3-card">
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

    <!-- Category Management & Retention Settings -->
    <section class="settings-section m3-card">
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
        <div v-for="cat in allCategories" :key="cat" class="checkbox-label" @click="toggleCategory(cat)">
          <input
            type="checkbox"
            :checked="targetCategories.includes(cat)"
            @change="toggleCategory(cat)"
            class="native-checkbox"
          />
          <span>{{ cat }}</span>
          <span class="remove-cat-btn" @click.stop.prevent="removeCategory(cat)" title="删除该分类">&times;</span>
        </div>
      </div>
    </section>

    <!-- Scheduler Settings -->
    <section class="settings-section m3-card">
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
          <input
            type="checkbox"
            :checked="form.schedule_enabled === 'true'"
            @change="form.schedule_enabled = form.schedule_enabled === 'true' ? 'false' : 'true'"
            class="native-switch"
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
    <section class="settings-section m3-card">
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
            <input
              type="checkbox"
              :checked="form.notify_tg_enabled === 'true'"
              @change="form.notify_tg_enabled = form.notify_tg_enabled === 'true' ? 'false' : 'true'"
              class="native-switch"
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
            <input
              type="checkbox"
              :checked="form.notify_qq_enabled === 'true'"
              @change="form.notify_qq_enabled = form.notify_qq_enabled === 'true' ? 'false' : 'true'"
              class="native-switch"
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
            <input
              type="checkbox"
              :checked="form.notify_webhook_enabled === 'true'"
              @change="form.notify_webhook_enabled = form.notify_webhook_enabled === 'true' ? 'false' : 'true'"
              class="native-switch"
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
import axios from 'axios';

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
});

const testingX = ref(false);
const xTestResult = ref('');
const xTestSuccess = ref(false);

const testingAI = ref(false);
const aiTestResult = ref('');
const aiTestSuccess = ref(false);

const fetchConfig = async () => {
  try {
    const res = await axios.get('/api/config');
    const data = res.data.data;
    Object.assign(form.value, data);

    if (data.target_categories) {
      try {
        targetCategories.value = JSON.parse(data.target_categories);
      } catch (e) {}
    }
    if (data.all_categories) {
      try {
        allCategories.value = JSON.parse(data.all_categories);
      } catch (e) {}
    } else if (data.custom_categories) {
      try {
        const custom = JSON.parse(data.custom_categories);
        allCategories.value = Array.from(new Set([...defaultCategories, ...custom]));
      } catch (e) {}
    }
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
    alert('该分类已存在');
    return;
  }
  allCategories.value.push(val);
  targetCategories.value.push(val);
  newCategoryName.value = '';
};

const removeCategory = (cat: string) => {
  if (allCategories.value.length <= 1) {
    alert('最少需保留一个分类');
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

const testTwitterCookie = async () => {
  testingX.value = true;
  xTestResult.value = '';
  try {
    const res = await axios.post('/api/test/twitter', {
      authToken: form.value.x_auth_token,
      ct0: form.value.x_ct0,
    });
    xTestSuccess.value = res.data.success;
    xTestResult.value = res.data.message;
  } catch (err: any) {
    xTestSuccess.value = false;
    xTestResult.value = '测试失败';
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
    const res = await axios.post('/api/test/ai');
    aiTestSuccess.value = res.data.success;
    aiTestResult.value = res.data.message;
  } catch (err: any) {
    aiTestSuccess.value = false;
    aiTestResult.value = '测试连接失败';
  } finally {
    testingAI.value = false;
  }
};

const testNotify = async (type: string) => {
  await saveAllConfigs(false);
  try {
    const res = await axios.post('/api/test/notification', { type });
    alert(res.data.message || '测试指令发送成功');
  } catch (err: any) {
    alert(`测试通知发送失败: ${err.response?.data?.message || err.message}`);
  }
};

const saveAllConfigs = async (notify = true) => {
  try {
    const payload = {
      ...form.value,
      target_categories: JSON.stringify(targetCategories.value),
      all_categories: JSON.stringify(allCategories.value),
    };
    await axios.post('/api/config', payload);
    if (notify) {
      alert('所有系统设置已成功保存！');
    }
  } catch (err: any) {
    alert(`保存失败: ${err.message}`);
  }
};

onMounted(() => {
  fetchConfig();
});
</script>

<style scoped>
.settings-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 900px;
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

.native-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--md-sys-color-primary);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
  margin-left: 4px;
  cursor: pointer;
}

.remove-cat-btn:hover {
  background-color: #c62828;
  color: white;
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

.native-switch {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--md-sys-color-primary);
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
</style>
