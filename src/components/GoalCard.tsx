import { useEffect, useMemo, useState } from "preact/hooks";
import type { GoalRecord, GoalStep } from "../types";
import { StepInput } from "./StepInput";
import { getCurrentChosen, getReadySteps, readHistory } from "../services/goals";
import { t, tp } from "../i18n";
import type { PWorkbenchSettings } from "../types";

interface GoalCardProps {
	plugin: { settings: PWorkbenchSettings };
	goal: GoalRecord;
	readyOptions?: string[];
	onReadyTextChange: (goal: GoalRecord, index: number, text: string) => Promise<void>;
	onChosenTextChange: (goal: GoalRecord, text: string) => Promise<void>;
	onGenerateAi: (goal: GoalRecord, currentText: string) => Promise<void>;
	onNextStep: (goal: GoalRecord, currentText: string, confirmedInUi: boolean) => Promise<boolean>;
	onOpenHistoryNote: (goal: GoalRecord, linkText: string) => Promise<void>;
	onRecord: (goal: GoalRecord) => Promise<void>;
	onSleep: (goal: GoalRecord) => Promise<boolean>;
	onArchive: (goal: GoalRecord) => Promise<void>;
	onFinish: (goal: GoalRecord) => Promise<void>;
}

export function GoalCard(props: GoalCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [saving, setSaving] = useState(false);
	const [sleepingPending, setSleepingPending] = useState(false);
	const [hiddenBySleep, setHiddenBySleep] = useState(false);
	const [confirmedText, setConfirmedText] = useState("");
	const chosen = getCurrentChosen(props.goal);
	const [localChosen, setLocalChosen] = useState(chosen?.description ?? "");

	useEffect(() => {
		setConfirmedText(chosen?.description ?? "");
		setLocalChosen(chosen?.description ?? "");
		setHiddenBySleep(false);
		setSleepingPending(false);
	}, [props.goal.file.path]);

	useEffect(() => {
		if (!saving && chosen?.description) {
			setLocalChosen(chosen.description);
			setConfirmedText(chosen.description);
		}
	}, [chosen?.description, saving]);

	const ready = (props.readyOptions && props.readyOptions.length > 0 ? props.readyOptions : getReadySteps(props.goal).map((s) => s.description)).slice(0, 3);
	const history = useMemo(() => readHistory(props.goal), [props.goal]);
	const currentStepIndex = useMemo(() => {
		const steps = props.goal.frontmatter.steps ?? [];
		if (!chosen) return 0;
		const idx = steps.findIndex((s: GoalStep) => s.id === chosen.id);
		return idx >= 0 ? idx + 1 : 0;
	}, [props.goal.frontmatter.steps, chosen]);

	const lastDone = history[0];
	const lastDoneTime = formatLastDone(lastDone?.completed_at, props.plugin.settings);
	const showAI = !chosen && confirmedText.trim() === "" && ready.length > 0;
	const localTrimmed = localChosen.trim();
	const confirmedInUi = localTrimmed.length > 0 && localTrimmed === confirmedText.trim();
	const needConfirm = localTrimmed.length > 0 && !confirmedInUi;

	const handleConfirm = async () => {
		setSaving(true);
		try {
			const text = localChosen.trim();
			await props.onChosenTextChange(props.goal, text);
			setLocalChosen(text);
			setConfirmedText(text);
		} catch {
			// Keep previous UI state on failure.
		} finally {
			setSaving(false);
		}
	};

	const handleNextStep = async () => {
		const ok = await props.onNextStep(props.goal, localTrimmed, confirmedInUi);
		if (ok) {
			setLocalChosen("");
			setConfirmedText("");
		}
	};

	const handleSleep = async () => {
		if (sleepingPending) {
			return;
		}
		setSleepingPending(true);
		const ok = await props.onSleep(props.goal);
		setSleepingPending(false);
		if (ok) {
			setHiddenBySleep(true);
		}
	};

	if (hiddenBySleep) {
		return null;
	}

	return (
		<section className="pwb-card">
			<div className="pwb-card-header">
				<div className="pwb-goal-title">🎯 {props.goal.title}</div>
				<div className="pwb-last-time">
					{t("Last progress", props.plugin.settings)}: {lastDoneTime}
				</div>
			</div>

			<div className="pwb-current-row">
				<span className="pwb-label">{t("Current", props.plugin.settings)}</span>
				<div className="pwb-input-group">
					<input
						className="pwb-current-input"
						type="text"
						value={localChosen}
						onInput={(e) => setLocalChosen(e.currentTarget.value)}
						placeholder={t("Choose or type the current step", props.plugin.settings)}
					/>
					{currentStepIndex > 0 && (
						<span className="pwb-step-badge">
							{tp("Step {{index}}", props.plugin.settings, { index: currentStepIndex })}
						</span>
					)}
					<div className="pwb-inline-buttons">
						{needConfirm && (
							<button
								className="pwb-btn-confirm mod-cta"
								disabled={saving}
								onClick={() => void handleConfirm()}
								title={t("Confirm this step", props.plugin.settings)}
							>
								{saving ? "..." : t("Select", props.plugin.settings)}
							</button>
						)}
						<button className="pwb-btn-ai" onClick={() => void props.onGenerateAi(props.goal, localChosen)}>
							{t("Ai suggestions", props.plugin.settings)}
						</button>
						<button className="pwb-btn-next" onClick={() => void handleNextStep()}>
							{t("Next step", props.plugin.settings)}
						</button>
						<button className="pwb-btn-record" onClick={() => void props.onRecord(props.goal)}>
							{t("Record", props.plugin.settings)}
						</button>
					</div>
				</div>
			</div>

			{showAI && (
				<div className="pwb-ready-list">
					{[0, 1, 2].map((index) => {
						const itemText = ready[index] ?? "";
						return (
							<StepInput
								settings={props.plugin.settings}
								key={`step-${props.goal.file.path}-${index}`}
								value={itemText}
								checked={localChosen === itemText}
								onChange={(text) => {
									void props.onReadyTextChange(props.goal, index, text);
								}}
								onChoose={() => {
									setLocalChosen(itemText);
								}}
							/>
						);
					})}
				</div>
			)}

			<div className="pwb-history">
				<div className="pwb-prev-row">
					<span className="pwb-label">{t("Previous", props.plugin.settings)}</span>
					<input className="pwb-current-input" readOnly value={lastDone?.description ?? ""} />
					<button className="mod-muted" onClick={() => setExpanded((prev) => !prev)}>
						{expanded ? t("Collapse", props.plugin.settings) : t("See all", props.plugin.settings)}
					</button>
				</div>
				{expanded && (
					<div className="pwb-history-list">
						{history.map((step) => (
							<div className="pwb-history-item" key={`${step.id}-${step.description}`}>
								<div>{step.description}</div>
								{step.completed_at && <div className="pwb-history-time">{step.completed_at}</div>}
								{step.note && <div className="pwb-history-note">{renderHistoryNote(step.note, props.goal, props.onOpenHistoryNote)}</div>}
							</div>
						))}
					</div>
				)}
			</div>

			<div className="pwb-goal-end-actions">
				<button className="mod-muted" disabled={sleepingPending} onClick={() => void handleSleep()}>
					{sleepingPending ? t("Sleeping...", props.plugin.settings) : t("Sleep", props.plugin.settings)}
				</button>
				<button className="mod-warning" onClick={() => void props.onArchive(props.goal)}>
					{t("Archive", props.plugin.settings)}
				</button>
				<button className="mod-cta" onClick={() => void props.onFinish(props.goal)}>
					{t("Finish", props.plugin.settings)}
				</button>
			</div>
		</section>
	);
}

function renderHistoryNote(note: string, goal: GoalRecord, onOpenHistoryNote: (goal: GoalRecord, linkText: string) => Promise<void>) {
	const linkMatch = note.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
	if (!linkMatch) {
		return note;
	}
	const fullMatch = linkMatch[0];
	const linkTarget = (linkMatch[1] ?? "").trim();
	const displayText = (linkMatch[2] ?? linkMatch[1] ?? "").trim();
	const before = note.slice(0, linkMatch.index ?? 0);
	const after = note.slice((linkMatch.index ?? 0) + fullMatch.length);

	return (
		<>
			{before}
			<span
				className="pwb-note-link"
				role="link"
				tabIndex={0}
				onClick={() => void onOpenHistoryNote(goal, linkTarget)}
				onKeyDown={(evt) => {
					if (evt.key === "Enter" || evt.key === " ") {
						evt.preventDefault();
						void onOpenHistoryNote(goal, linkTarget);
					}
				}}
			>
				{displayText || fullMatch}
			</span>
			{after}
		</>
	);
}

function formatLastDone(value: string | undefined, settings: PWorkbenchSettings): string {
	if (!value) return t("No history", settings);
	const datePart = value.slice(0, 10);
	const today = new Date().toISOString().slice(0, 10);
	if (datePart === today) return t("Today", settings);

	const d1 = new Date(datePart);
	const d2 = new Date(today);
	const diffTime = Math.abs(d2.getTime() - d1.getTime());
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

	if (diffDays >= 1 && diffDays <= 6) return tp("{{days}}d ago", settings, { days: diffDays });
	return datePart;
}
