import { randomUUID } from 'crypto';
import { getSystemConfig, setSystemConfig } from './config';

export interface PromptPreset {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  builtIn?: boolean;
}

export const DEFAULT_PRESET_ID = 'builtin-editor';

export const JSON_SCHEMA_TEXT = `{
  "isNews": true/false (判定该推文是否包含有效的新闻/资讯/深度信息，若仅为日常闲聊、广告骚扰则为 false),
  "title": "简短精炼的新闻标题（20字以内）",
  "summary": "1-2句精炼的新闻摘要概括",
  "markdownContent": "完整的新闻 Markdown 报告。格式包含：## 新闻背景、## 核心要点（列表）、## 原推评论与影响。包含原推链接 [查看原推]({{url}})",
  "category": "主要分类，{{categoryHint}}",
  "importance": 1-5 (重要度评分，数字 1-5，5表示重大新闻)
}`;

export const DEFAULT_SYSTEM_PROMPT = '你是一个严格输出 JSON 格式的新闻提炼分析助手。';

export const DEFAULT_USER_PROMPT = `你是一个专业的新闻主编与信息提炼分析专家。请仔细阅读以下抓取自 X (Twitter) 的原始推文内容，并进行分析总结。

推文发布者: {{authorName}} (@{{authorUsername}})
发布时间: {{createdAt}}
原推链接: {{url}}
推文正文:
"""
{{text}}
"""

请按以下 JSON 格式输出分析结果（不要输出 markdown 代码块，只输出纯 JSON）：
{{jsonSchema}}`;

export function createDefaultPreset(): PromptPreset {
  return {
    id: DEFAULT_PRESET_ID,
    name: '专业主编',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_USER_PROMPT,
    builtIn: true,
  };
}

function parsePresets(raw: string): PromptPreset[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
      .map((item) => ({
        id: item.id,
        name: String(item.name),
        systemPrompt: String(item.systemPrompt || ''),
        userPromptTemplate: String(item.userPromptTemplate || ''),
        builtIn: Boolean(item.builtIn) || item.id === DEFAULT_PRESET_ID,
      }));
  } catch {
    return null;
  }
}

export async function listPromptPresets(): Promise<{ presets: PromptPreset[]; activeId: string }> {
  const stored = parsePresets(await getSystemConfig('ai_prompt_presets'));
  let presets = stored && stored.length > 0 ? stored : [createDefaultPreset()];

  const hasBuiltin = presets.some((p) => p.id === DEFAULT_PRESET_ID);
  if (!hasBuiltin) {
    presets = [createDefaultPreset(), ...presets];
  } else {
    presets = presets.map((p) => (p.id === DEFAULT_PRESET_ID ? { ...p, builtIn: true } : p));
  }

  if (!stored) {
    await setSystemConfig('ai_prompt_presets', JSON.stringify(presets));
  }

  let activeId = (await getSystemConfig('ai_prompt_active_id', DEFAULT_PRESET_ID)).trim() || DEFAULT_PRESET_ID;
  if (!presets.some((p) => p.id === activeId)) {
    activeId = presets[0].id;
    await setSystemConfig('ai_prompt_active_id', activeId);
  }

  return { presets, activeId };
}

async function savePresets(presets: PromptPreset[]): Promise<void> {
  await setSystemConfig('ai_prompt_presets', JSON.stringify(presets));
}

export async function getActivePreset(): Promise<PromptPreset> {
  const { presets, activeId } = await listPromptPresets();
  return presets.find((p) => p.id === activeId) || presets[0] || createDefaultPreset();
}

export async function createPromptPreset(input: { name: string; systemPrompt: string; userPromptTemplate: string }): Promise<PromptPreset> {
  const { presets } = await listPromptPresets();
  const preset: PromptPreset = {
    id: randomUUID(),
    name: input.name.trim(),
    systemPrompt: input.systemPrompt,
    userPromptTemplate: input.userPromptTemplate,
    builtIn: false,
  };
  presets.push(preset);
  await savePresets(presets);
  return preset;
}

export async function updatePromptPreset(
  id: string,
  input: { name?: string; systemPrompt?: string; userPromptTemplate?: string },
): Promise<PromptPreset> {
  const { presets } = await listPromptPresets();
  const idx = presets.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error('预设不存在');
  if (input.name !== undefined) presets[idx].name = input.name.trim() || presets[idx].name;
  if (input.systemPrompt !== undefined) presets[idx].systemPrompt = input.systemPrompt;
  if (input.userPromptTemplate !== undefined) presets[idx].userPromptTemplate = input.userPromptTemplate;
  if (presets[idx].id === DEFAULT_PRESET_ID) presets[idx].builtIn = true;
  await savePresets(presets);
  return presets[idx];
}

export async function deletePromptPreset(id: string): Promise<void> {
  const { presets, activeId } = await listPromptPresets();
  const target = presets.find((p) => p.id === id);
  if (!target) throw new Error('预设不存在');
  if (target.builtIn || target.id === DEFAULT_PRESET_ID) throw new Error('内置预设不可删除');
  if (target.id === activeId) throw new Error('请先切换到其他预设再删除当前启用项');
  await savePresets(presets.filter((p) => p.id !== id));
}

export async function activatePromptPreset(id: string): Promise<string> {
  const { presets } = await listPromptPresets();
  if (!presets.some((p) => p.id === id)) throw new Error('预设不存在');
  await setSystemConfig('ai_prompt_active_id', id);
  return id;
}

export async function resetPromptPreset(id: string): Promise<PromptPreset> {
  if (id !== DEFAULT_PRESET_ID) throw new Error('仅内置预设支持恢复默认');
  const { presets } = await listPromptPresets();
  const idx = presets.findIndex((p) => p.id === DEFAULT_PRESET_ID);
  const restored = createDefaultPreset();
  if (idx >= 0) presets[idx] = restored;
  else presets.unshift(restored);
  await savePresets(presets);
  return restored;
}

export function interpolatePrompt(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? '';
  });
}

export function buildUserPrompt(template: string, vars: Record<string, string>): string {
  const withSchema = template.includes('{{jsonSchema}}')
    ? template
    : `${template.trim()}\n\n请按以下 JSON 格式输出分析结果（不要输出 markdown 代码块，只输出纯 JSON）：\n{{jsonSchema}}`;
  return interpolatePrompt(withSchema, vars);
}
