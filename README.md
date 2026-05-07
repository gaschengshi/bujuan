# Bujuan – P-Type Workbench

[中文文档](./README_CN.md)

An Obsidian plugin for those who get distracted easily but still want to make steady progress.  
It brings together *what to do today, what to do next, and what you’ve already done* in one independent dashboard, keeping the startup cost as low as possible.  
**Important: Please install the Dataview plugin first, otherwise this plugin won't work.**

## Core Features

- **Standalone workbench view** – Card-based display of today’s goals and current steps.
- **AI next-step suggestions** – Generate 3 candidate steps with one click; select one to adopt it.
- **Current step management** – Supports manual input, confirm selection, and finish a step in one action.
- **History** – View completed steps with timestamps.
- **Inspiration note linking** – After recording an idea, the `[[note]]` link in history becomes clickable.
- **Goal status management** – Supports `active`, `dormant`, `completed`, and `archived` statuses.
- **Dormancy mechanism** – Goals can be put to sleep and automatically wake up when re-selected.
- **Re-select today’s tasks** – Search and filter to quickly swap the goals in focus for the day.
- **Random goal picker** – “Pick one for me” via a command or ribbon icon with one click.

## AI Support

- Uses OpenAI-compatible API.
- Configurable settings: `API Key`, `Base URL`, `Model`, and Prompt template.
- Automatically completes the request endpoint to `/v1/chat/completions`.

## How to Use

- Left ribbon icons:
  - `leaf` – Open the P-Type Workbench
  - `dice` – Randomly pick a goal
- Command palette (`Ctrl/Cmd + P`):
  - `Open P-Type Workbench`
  - `P-Type Workbench: Pick one for me`
  - `New goal`
  - `Re-select`

## Quick Start

1. Fill in your AI configuration in the plugin settings first.
2. Use “Add Goal” to create or join a goal for today.
3. In a goal card, click “AI Suggestions” or manually enter the current step.
4. After clicking “Select” to confirm, use “Next Step” to finish the current step.
5. When you want to capture an idea, click “Record”; an inspiration note will be created and opened automatically.

## Who Is This For

- People who want to break big goals into small, actionable steps.
- Anyone who needs a “low-friction start + visual progress” workflow.
