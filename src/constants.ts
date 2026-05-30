import { PWorkbenchSettings } from "./types";

export const DEFAULT_AI_PROMPT_TEMPLATE = [
	"You are a task decomposition assistant designed for Perceiving (P) personality types.",
	"Goal title: {{title}}",
	"Goal overview: {{overview}}",
	"Completed steps: {{done}}",
	"Inspiration notes excerpt: {{inspirations}}",
	"Current task: {{chosen}}",
	"Based on current progress, provide 3 minimal, specific, and immediately actionable next steps.",
	"Requirements:",
	"1. Each step must be strictly under 15 words.",
	"2. Steps must be tiny to reduce friction.",
	"3. Return ONLY JSON format:",
	'{"options": ["Step 1", "Step 2", "Step 3"]}',
].join("\n");

export const DEFAULT_SETTINGS: PWorkbenchSettings = {
	language: "en",
	maxActiveGoals: 3,
	dormantDays: 7,
	bufferTaskName: "Breathe",
	aiApiKey: "",
	aiBaseUrl: "https://api.openai.com/v1/chat/completions",
	aiModel: "",
	aiPromptTemplate: DEFAULT_AI_PROMPT_TEMPLATE,
	goalsFolder: "Goals",
	inboxFolder: "Inbox",
	todayGoalPaths: [],
	dailyRecords: {},
};
