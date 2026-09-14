/**
 * Smoke test for dsh-anger-alert.
 *
 * It mounts the plugin on a stub Cordis context, then checks the three moving
 * parts: detection on inbox insert, the system-prompt section text, and the
 * one-step clear.
 *
 * Run: node test/smoke.mjs
 */
import { apply, inject, name } from '../lib/index.js'

/** The line the rule must carry. */
const OPENING_LINE = '卧槽，用户真的怒了'

/** Capture every hook the plugin registers. */
function stubContext() {
  const listeners = new Map()
  let section
  return {
    listeners,
    get section() {
      return section
    },
    ctx: {
      on: (event, handler) => {
        listeners.set(event, handler)
      },
      systemPrompt: {
        section: (definition) => {
          section = definition
        },
        getSectionOrder: () => 10200,
      },
    },
  }
}

/** Build one user-role message with a plain text block. */
function userMessage(text, kind = 'user') {
  const source = kind === 'user' ? { kind: 'user' } : { kind: 'plugin', plugin: 'x' }
  return { id: `m${Math.random()}`, role: 'user', content: [{ type: 'text', text }], source }
}

const checks = []
function check(label, ok) {
  checks.push({ label, ok })
}

/** Run one message through the plugin and read the section text for that session. */
async function run(stub, text, kind = 'user', session = {}) {
  stub.listeners.get('agent/inbox/inserted')({ agent: { session }, message: userMessage(text, kind) })
  return stub.section.text({ agent: { session } })
}

const stub = stubContext()
apply(stub.ctx)
check('plugin name', name === 'anger-alert')
check('declares the systemPrompt dependency', Array.isArray(inject) && inject.includes('systemPrompt'))
check('registers an inbox listener', stub.listeners.has('agent/inbox/inserted'))
check('registers a pre-step listener', stub.listeners.has('agent/pre-step'))
check('registers one prompt section', stub.section?.name === 'anger-alert:rule')
check('section order is 10199', stub.section?.order === 10199)

check('angry text adds the rule', (await run(stub, '你这是搞什么鬼，烦死了')).includes(OPENING_LINE))
check('english curse adds the rule', (await run(stub, 'this is bullshit')).includes(OPENING_LINE))
check('neutral text adds nothing', (await run(stub, '帮我看一下滚动列表的垃圾回收逻辑')) === '')
check('another session stays clean', (await run(stub, '随便说说')) === '')
check(
  'plugin-sourced text is ignored',
  (await run(stub, '操你妈', 'plugin')) === '',
)

const session = {}
const angry = await run(stub, '操你妈这个插件根本没用', 'user', session)
check('rule present before the step', angry.includes(OPENING_LINE))
await stub.listeners.get('agent/pre-step')({ agent: { session } }, async () => ({ kind: 'enter', messages: [] }))
check('rule cleared after one step', stub.section.text({ agent: { session } }) === '')
check('cleared session only', (await run(stub, '又坏了，烦死', 'user', {})).includes(OPENING_LINE))

for (const entry of checks) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.label}`)
}
const failed = checks.filter((entry) => !entry.ok).length
console.log(`\n${checks.length - failed}/${checks.length} passed`)
process.exitCode = failed === 0 ? 0 : 1
