/**
 * llm-clients — LLM 客戶端抽象層
 *
 * 介面只描述 chat / embed，不綁定特定 SDK。
 * 預設實作為 OpenAICompatibleClient：任何 /v1/chat/completions 兼容端點
 * （OpenAI、MiniMax、DeepSeek、Anthropic-compatible、Groq、Together 等）
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** response_format: { type: 'json_object' } 讓模型保證回 JSON */
  jsonMode?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw?: unknown;
}

export interface EmbedRequest {
  input: string | string[];
  model?: string;
}

export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  usage?: { promptTokens: number; totalTokens: number };
}

export interface LLMClient {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  embed?(request: EmbedRequest): Promise<EmbedResponse>;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`[llm-clients] ${method} 尚未實作`);
    this.name = 'NotImplementedError';
  }
}

export class LLMConfigError extends Error {
  constructor(message: string) {
    super(`[llm-clients] 設定錯誤: ${message}`);
    this.name = 'LLMConfigError';
  }
}

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

/**
 * 從環境變數讀設定並驗證。
 */
export function readLLMConfigFromEnv(): OpenAICompatibleConfig {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!baseUrl) throw new LLMConfigError('OPENAI_BASE_URL 未設定');
  if (!apiKey || apiKey === 'your-key-here') throw new LLMConfigError('OPENAI_API_KEY 未設定或為 placeholder');
  if (!model) throw new LLMConfigError('OPENAI_MODEL 未設定');
  return { baseUrl, apiKey, model };
}

/**
 * 用 dynamic import 避開在 SSR / 沒裝的人環境炸掉。
 */
export class OpenAICompatibleClient implements LLMClient {
  readonly name = 'openai-compatible';
  private readonly cfg: OpenAICompatibleConfig;

  constructor(cfg: OpenAICompatibleConfig) {
    this.cfg = cfg;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    // 動態 import：openai SDK 沒裝時才不炸
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: this.cfg.apiKey,
      baseURL: this.cfg.baseUrl,
      timeout: this.cfg.timeoutMs ?? 30_000,
    });

    const body: Record<string, unknown> = {
      model: req.model ?? this.cfg.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content, name: m.name, tool_call_id: m.tool_call_id })),
    };
    if (req.temperature != null) body.temperature = req.temperature;
    if (req.maxTokens != null) body.max_tokens = req.maxTokens;
    if (req.jsonMode) body.response_format = { type: 'json_object' };

    const resp = await client.chat.completions.create(body as never);
    const choice = resp.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      model: resp.model,
      usage: resp.usage
        ? {
            promptTokens: resp.usage.prompt_tokens ?? 0,
            completionTokens: resp.usage.completion_tokens ?? 0,
            totalTokens: resp.usage.total_tokens ?? 0,
          }
        : undefined,
      raw: resp,
    };
  }
}

let _singleton: LLMClient | null = null;
export function createLLMClientFromEnv(): LLMClient {
  if (_singleton) return _singleton;
  _singleton = new OpenAICompatibleClient(readLLMConfigFromEnv());
  return _singleton;
}
