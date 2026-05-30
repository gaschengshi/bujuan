import { requestUrl } from "obsidian";
import type PWorkbenchPlugin from "../main";
import { DEFAULT_AI_PROMPT_TEMPLATE } from "../constants";

export interface AiResponsePayload {
	options?: string[];
	choices?: Array<{ message?: { content?: string } }>;
	error?: { message?: string; type?: string };
}

function parseJsonFromText(text: string): AiResponsePayload | null {
	const raw = text.trim();
	try {
		return JSON.parse(raw) as AiResponsePayload;
	} catch {
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) {
			return null;
		}
		try {
			return JSON.parse(match[0]) as AiResponsePayload;
		} catch {
			return null;
		}
	}
}

function normalizeOptions(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((item) => String(item).trim().slice(0, 15))
		.filter((item) => item.length > 0)
		.slice(0, 3);
}

export async function requestNextStepOptions(
	plugin: PWorkbenchPlugin,
	input: { title: string; overview?: string; done: string[]; chosen: string; inspirations?: string[] }
): Promise<string[]> {
	const apiKey = plugin.settings.aiApiKey.trim();
	const baseUrl = plugin.settings.aiBaseUrl.trim();
	if (!apiKey || !baseUrl) {
		throw new Error("missing-ai-config");
	}

	let endpoint = baseUrl.replace(/\/+$/, "");
	if (!/\/chat\/completions$/i.test(endpoint)) {
		endpoint = `${endpoint}/v1/chat/completions`;
	}
	const configuredModel = plugin.settings.aiModel?.trim();
	const model = configuredModel || (/deepseek/i.test(endpoint) ? "deepseek-chat" : "gpt-4o-mini");

	const template = plugin.settings.aiPromptTemplate?.trim() || DEFAULT_AI_PROMPT_TEMPLATE;
	const prompt = template
		.split("{{title}}")
		.join(input.title || "暂无")
		.split("{{overview}}")
		.join(input.overview || "暂无")
		.split("{{done}}")
		.join(input.done.join("；") || "暂无")
		.split("{{inspirations}}")
		.join(input.inspirations?.join("；") || "暂无")
		.split("{{chosen}}")
		.join(input.chosen || "暂无");

	try {
		const response = await requestUrl({
			url: endpoint,
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				temperature: 0.5,
				messages: [
					{ role: "system", content: "你是一个专业的任务分解专家。你只输出纯 JSON 格式，不包含任何 Markdown 代码块或额外解释。" },
					{ role: "user", content: prompt },
				],
			}),
		});

		if (response.status < 200 || response.status >= 300) {
			const payload = parseJsonFromText(response.text);
			const message = payload?.error?.message || `HTTP ${response.status}`;
			throw new Error(`ai-http-error:${message}`);
		}

		const payload = parseJsonFromText(response.text);
		const firstPass = normalizeOptions(payload?.options);
		if (firstPass.length === 3) {
			return firstPass;
		}

		// 如果第一层没拿到 options，尝试从 choices 里的 content 解析
		const content = payload?.choices?.[0]?.message?.content ?? response.text;
		const nested = parseJsonFromText(content);
		const secondPass = normalizeOptions(nested?.options);
		if (secondPass.length > 0) {
			return secondPass;
		}

		console.error("[P人工作台] AI 返回格式异常", response.text);
		throw new Error("ai-format-error");
	} catch (error) {
		console.error("[P人工作台] AI 请求失败", error);
		const msg = (error as Error).message ?? "";
		if (msg === "ai-format-error" || msg.startsWith("ai-http-error:")) {
			throw error;
		}
		throw new Error("ai-network-error");
	}
}
