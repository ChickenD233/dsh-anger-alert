/**
 * Smoke test for dsh-anger-alert.
 *
 * It mounts the plugin on a stub Cordis context, then runs three pre-step
 * cases: an angry message, a neutral message, and a repeated step.
 *
 * Run: node test/smoke.mjs
 */
import { apply, name } from '../lib/index.js'

/** The notice text the plugin must inject. */
const OPENING_LINE = '卧槽，用户真的怒了'

/** Capture the plugin's one `agent/pre-step` listener. */
function stubContext() {
  const listeners = []
  return {
    listeners,
    ctx: { on: (event, handler) => listeners.push({ event, handler }) },
  }
}

/** Build one user-role message with a plain text block. */
function userMessage(id, text) {
  return { id, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } }
}

/** Run one pre-step through the captured listener. */
async function runStep(handler, messages, existing = messages) {
  return handler({ messages, signal: { aborted: false } }, async () => ({
    kind: 'enter',
    messages: existing,
  }))
}

const checks = []
function check(label, ok) {
  checks.push({ label, ok })
}

const { ctx, listeners } = stubContext()
apply(ctx)
check('plugin name', name === 'anger-alert')
check('one listener registered', listeners.length === 1 && listeners[0].event === 'agent/pre-step')

const handler = listeners[0].handler

const angry = userMessage('m1', '卧槽你到底在搞什么，这个破功能又坏了，烦死了')
const angryDecision = await runStep(handler, [angry])
const injected = angryDecision.messages.at(-1)
check('angry message adds one notice', angryDecision.messages.length === 2)
check('notice is a plugin notice', injected?.source?.kind === 'plugin' && injected.source.form === 'notice')
check('notice opens with the fixed line', String(injected?.content?.[0]?.text).includes(OPENING_LINE))
check('notice keeps the original message first', angryDecision.messages[0] === angry)

const calm = userMessage('m2', '帮我看一下滚动列表的垃圾回收逻辑')
const calmDecision = await runStep(handler, [calm])
check('neutral technical text adds nothing', calmDecision.messages.length === 1)

const repeated = await runStep(handler, [angry], [...angryDecision.messages])
check('a repeated step adds no second notice', repeated.messages.length === 2)

const english = await runStep(handler, [userMessage('m3', 'this is bullshit, fix it')])
check('english curse detected', english.messages.length === 2)

for (const entry of checks) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.label}`)
}
const failed = checks.filter((entry) => !entry.ok).length
console.log(`\n${checks.length - failed}/${checks.length} passed`)
process.exitCode = failed === 0 ? 0 : 1
