#!/usr/bin/env node
// Coding-agent hook adapter for the agentlint gate. Copy to .agentlint/hooks/agentlint-gate.mjs.
//
//   node .agentlint/hooks/agentlint-gate.mjs stop   Stop hook: complete gate (`check --all`)
//   node .agentlint/hooks/agentlint-gate.mjs edit   PostToolUse hook: changed files (`check`)
//
// Claude Code and Codex share the contract used here: hook input is JSON on stdin,
// exit code 2 hands stderr back to the agent, and `stop_hook_active` marks a stop
// that a hook already blocked once. The adapter owns no gate semantics.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const mode = process.argv[2] === 'edit' ? 'edit' : 'stop';
const root = resolve(import.meta.dirname, '../..');

const readInput = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    // REASON: missing stdin means there is no prior gate payload to merge.
    return {};
  }
};

const findFrom = (directory) => {
  const candidate = join(directory, 'node_modules/@aurelienbbn/agentlint/dist/bin.mjs');
  if (existsSync(candidate)) return candidate;
  if (dirname(directory) === directory) return undefined;
  return findFrom(dirname(directory));
};

const findBin = () => findFrom(root);

const editTools = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch']);
const callTypes = new Set(['tool_use', 'function_call', 'custom_tool_call']);

// Codex code mode routes every tool through `exec`; a patch shows only in its input.
const isEditCall = (node) => {
  if (Array.isArray(node)) return node.some(isEditCall);
  if (node === null || typeof node !== 'object') return false;
  if (callTypes.has(node.type) && editTools.has(node.name)) return true;
  if (callTypes.has(node.type) && `${node.input ?? node.arguments ?? ''}`.includes('*** Begin Patch')) return true;
  return Object.values(node).some(isEditCall);
};

// Claude Code logs a typed prompt as a user message without tool results; hook
// feedback, compaction summaries and task notifications are not prompts. Codex
// logs each turn as `task_started` (older builds: `user_message`).
const isTurnStart = (entry) => {
  if (entry?.type === 'event_msg') return ['task_started', 'user_message'].includes(entry.payload?.type);
  if (entry?.type !== 'user' || entry.isMeta === true || entry.isCompactSummary === true) return false;
  const content = entry.message?.content;
  if (typeof content === 'string') return !content.startsWith('<task-notification>');
  return Array.isArray(content) && !content.some((block) => block?.type === 'tool_result');
};

// Only a turn that called an edit tool is gated: a question, a review, or talk after
// earlier coding changed nothing, so open findings (often another agent's work in
// progress) must not hijack the reply. Edits made through a shell go unseen; CI
// still gates them. Without a readable transcript the gate runs.
const turnEdited = (transcriptPath) => {
  if (typeof transcriptPath !== 'string' || !existsSync(transcriptPath)) return true;
  const entries = readFileSync(transcriptPath, 'utf8')
    .split('\n')
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        // REASON: a partially written last line holds no completed tool call.
        return [];
      }
    });
  return entries.slice(entries.findLastIndex(isTurnStart) + 1).some(isEditCall);
};

if (mode === 'stop') {
  const input = readInput();
  // A stop that this hook already blocked continues, so a finding the agent cannot
  // close (human authority) interrupts once instead of looping.
  if (input.stop_hook_active === true) process.exit(0);
  if (!turnEdited(input.transcript_path)) process.exit(0);
}

const bin = findBin();
if (!bin) {
  console.error('agentlint hook: @aurelienbbn/agentlint is not installed; gate skipped.');
  process.exit(0);
}

const result = spawnSync(process.execPath, [bin, 'check', ...(mode === 'stop' ? ['--all'] : [])], {
  cwd: root,
  encoding: 'utf8',
});
if (result.status === 0) process.exit(0);

const output = `${result.stdout}${result.stderr}`.trim();
const instruction =
  result.status === 1
    ? mode === 'stop'
      ? 'The agentlint gate is closed. Resolve every finding: change the evidence, or `accept` an agent-authority finding with a concrete reason. For a human-authority finding, `propose` your work and tell the user to run `agentlint review`.'
      : 'agentlint reported unresolved findings for the current change. Resolve them before you finish.'
    : 'agentlint could not evaluate the gate. Fix the configuration or evidence error first.';
console.error(`${output}\n\n${instruction}`);
process.exit(2);
