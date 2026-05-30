import { useEffect, useMemo, useState } from "preact/hooks";
import { Notice } from "obsidian";
import type PWorkbenchPlugin from "../main";
import type { GoalRecord } from "../types";
import { GoalCard } from "./GoalCard";
import { t, tp } from "../i18n";
import {
	addGoalToToday,
	archiveGoal,
	applyNextStepResult,
	buildAiContextWithInspiration,
	collectGoalNameCandidates,
	createOrOpenInspiration,
	finishGoal,
	sleepGoal,
	updateChosenStepText,
	getCurrentChosen,
} from "../services/goals";
import { requestNextStepOptions } from "../services/ai";

interface DashboardProps {
	plugin: PWorkbenchPlugin;
	goals: GoalRecord[];
	onRefresh: () => Promise<void>;
}

export function Dashboard(props: DashboardProps) {
	const [goalName, setGoalName] = useState("");
	const [busy, setBusy] = useState(false);
	const [aiOptionsByGoal, setAiOptionsByGoal] = useState<Record<string, string[]>>({});
	const [sleepingPaths, setSleepingPaths] = useState<Set<string>>(new Set());
	const checkedInToday = props.plugin.isCheckedInToday();
	const streakDays = props.plugin.getCheckInStreakDays();
	const bufferTaskName = props.plugin.settings.bufferTaskName || t("Breathe", props.plugin.settings);
	const maxGoals = props.plugin.settings.maxActiveGoals;
	const suggestions = useMemo(() => collectGoalNameCandidates(props.plugin, goalName), [props.plugin, goalName, props.goals]);
	const effectiveGoals = useMemo(
		() => props.goals.filter((goal) => !sleepingPaths.has(goal.file.path)),
		[props.goals, sleepingPaths]
	);
	const leftCount = Math.max(0, maxGoals - effectiveGoals.length);
	const today = new Date().toLocaleDateString();

	useEffect(() => {
		// 当外部 goals 刷新后，清理已不在列表中的临时休眠路径
		setSleepingPaths((prev) => {
			if (prev.size === 0) {
				return prev;
			}
			const next = new Set<string>();
			const activePaths = new Set(props.goals.map((g) => g.file.path));
			for (const path of prev) {
				if (activePaths.has(path)) {
					next.add(path);
				}
			}
			return next;
		});
	}, [props.goals]);

	const createGoal = async () => {
		if (!goalName.trim()) {
			new Notice(t("Goal name empty", props.plugin.settings));
			return;
		}
		setBusy(true);
		try {
			const prev = props.plugin.settings.todayGoalPaths ?? [];
			// 检查是否已达到上限
			if (prev.length >= maxGoals) {
				new Notice(tp("Goal limit reached", props.plugin.settings, { max: maxGoals }));
				return;
			}
			const file = await addGoalToToday(props.plugin, goalName);
			const dedup = [file.path, ...prev.filter((p) => p !== file.path)];
			await props.plugin.updateTodayGoalPaths(dedup);
			setGoalName("");
		} catch (error) {
			const code = (error as Error).message;
			if (code === "goal-not-active") {
				new Notice(t("Goal not active", props.plugin.settings));
			} else if (code === "goal-dormant") {
				new Notice(t("Goal dormant", props.plugin.settings));
			} else {
				new Notice(t("Failed to add goal", props.plugin.settings));
			}
		} finally {
			setBusy(false);
		}
	};

	const completeBufferTask = async () => {
		if (busy || checkedInToday) {
			return;
		}
		setBusy(true);
		try {
			const isFirst = await props.plugin.checkInToday({
				type: "buffer",
				label: bufferTaskName,
			});
			if (isFirst) {
				new Notice(tp("Check-in successful", props.plugin.settings, { days: props.plugin.getCheckInStreakDays() }));
			}
			await props.onRefresh();
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="pwb-dashboard">
			<div className="pwb-streak-row">
				<span className="pwb-streak-label">{t("Checked in for", props.plugin.settings)}</span>
				<span className="pwb-streak-value">{streakDays}</span>
				<span className="pwb-streak-label">{t("days", props.plugin.settings)}</span>
			</div>
			<header className="pwb-top">
				<div className="pwb-date">
					{t("Today", props.plugin.settings)}: {today}
				</div>
				<div className="pwb-focus-count">{tp("Focus on {{count}} more things", props.plugin.settings, { count: leftCount })}</div>
			</header>

			<div className="pwb-add-row">
				<input
					list="pwb-goal-suggest"
					value={goalName}
					onInput={(evt) => setGoalName(evt.currentTarget.value)}
					placeholder={t("Add goal: enter name to match/create", props.plugin.settings)}
				/>
				<datalist id="pwb-goal-suggest">
					{suggestions.map((name) => (
						<option key={name} value={name} />
					))}
				</datalist>
				<button disabled={busy} onClick={() => void createGoal()}>
					{t("Add goal", props.plugin.settings)}
				</button>
			</div>

			<div className="pwb-card-list">
				{effectiveGoals.map((goal) => (
					<GoalCard
						plugin={props.plugin}
						key={goal.file.path}
						goal={goal}
						readyOptions={aiOptionsByGoal[goal.file.path]}
						onReadyTextChange={async (item, index, text) => {
							setAiOptionsByGoal((prev) => {
								const current = [...(prev[item.file.path] ?? ["", "", ""])];
								current[index] = text;
								return { ...prev, [item.file.path]: current.slice(0, 3) };
							});
						}}
						onChosenTextChange={async (item, text) => {
							await updateChosenStepText(props.plugin, item, text);
							setAiOptionsByGoal((prev) => ({ ...prev, [item.file.path]: [] }));
							// 立即触发刷新并再补一次微延时刷新，确保 metadataCache 完成同步
							await props.onRefresh();
							await new Promise((resolve) => window.setTimeout(resolve, 80));
							await props.onRefresh();
						}}
						onGenerateAi={async (item, currentText) => {
							setBusy(true);
							try {
								const context = await buildAiContextWithInspiration(props.plugin, item);
								if (currentText.trim()) {
									context.chosen = currentText.trim();
								}
								let options: string[] = [];
								try {
									options = await requestNextStepOptions(props.plugin, context);
								} catch (error) {
									const code = (error as Error).message;
									if (code === "missing-ai-config") {
										new Notice("AI 未配置，请先填写 API 配置。");
									} else if (code.startsWith("ai-http-error:")) {
										new Notice(`AI 接口错误：${code.replace("ai-http-error:", "")}`);
									} else if (code === "ai-format-error") {
										new Notice("AI 返回格式不符合要求。");
									} else {
										new Notice("AI 生成失败。");
									}
								}
								setAiOptionsByGoal((prev) => ({ ...prev, [item.file.path]: options.slice(0, 3) }));
							} finally {
								setBusy(false);
							}
						}}
						onNextStep={async (item, currentText, confirmedInUi) => {
							setBusy(true);
							try {
								const currentChosen = getCurrentChosen(item);
								if (currentText.trim() && !confirmedInUi && (!currentChosen || currentText.trim() !== currentChosen.description)) {
									new Notice(t("Input unconfirmed", props.plugin.settings));
									return false;
								}
								if (!currentChosen) {
									if (currentText.trim() && confirmedInUi) {
										await updateChosenStepText(props.plugin, item, currentText.trim());
									} else {
										new Notice(t("Input unconfirmed", props.plugin.settings));
										return false;
									}
								}
								const completed = await applyNextStepResult(props.plugin, item);
								await props.onRefresh();
								await new Promise((resolve) => window.setTimeout(resolve, 80));
								await props.onRefresh();
								if (!completed) {
									setAiOptionsByGoal((prev) => ({ ...prev, [item.file.path]: [] }));
									return false;
								}
								const isFirst = await props.plugin.checkInToday({
									type: "step",
									label: currentText.trim() || currentChosen?.description || item.title,
									goalPath: item.file.path,
								});
								if (isFirst) {
									new Notice(tp("Check-in successful", props.plugin.settings, { days: props.plugin.getCheckInStreakDays() }));
								}
								setAiOptionsByGoal((prev) => ({ ...prev, [item.file.path]: [] }));
								return true;
							} finally {
								setBusy(false);
							}
						}}
						onRecord={async (item) => {
							await createOrOpenInspiration(props.plugin, item);
							await props.onRefresh();
						}}
						onOpenHistoryNote={async (item, linkText) => {
							const target = linkText.trim();
							if (!target) {
								return;
							}
							const file = props.plugin.app.metadataCache.getFirstLinkpathDest(target, item.file.path);
							if (!file) {
								new Notice(tp("Note not found: {{target}}", props.plugin.settings, { target }));
								return;
							}
							await props.plugin.app.workspace.getLeaf(true).openFile(file);
						}}
						onSleep={(item) => {
							return sleepGoal(props.plugin, item)
								.then(async () => {
									await props.onRefresh();
									await new Promise((resolve) => window.setTimeout(resolve, 80));
									await props.onRefresh();
									return true;
								})
								.catch(() => {
									// 失败时回滚 UI
									setSleepingPaths((prev) => {
										const next = new Set(prev);
										next.delete(item.file.path);
										return next;
									});
									new Notice(t("Sleep failed", props.plugin.settings));
									return false;
								});
						}}
						onArchive={(item) => {
							return archiveGoal(props.plugin, item).then(async () => {
								await props.onRefresh();
								await new Promise((resolve) => window.setTimeout(resolve, 80));
								await props.onRefresh();
							});
						}}
						onFinish={(item) => {
							return finishGoal(props.plugin, item).then(async () => {
								await props.onRefresh();
								await new Promise((resolve) => window.setTimeout(resolve, 80));
								await props.onRefresh();
							});
						}}
					/>
				))}
				{!checkedInToday && (
					<button
						className="pwb-buffer-task"
						onClick={() => {
							void completeBufferTask();
						}}
						disabled={busy}
					>
						🌱 {bufferTaskName}
					</button>
				)}
			</div>
		</div>
	);
}
