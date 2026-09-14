/**
 * dsh-anger-alert — angry-user detector for the DeepSeek Harness.
 *
 * When a user message shows anger or holds a curse word, the plugin adds one
 * short rule to the system prompt of the next model step. The rule orders the
 * model to open its reasoning with the fixed line 卧槽，用户真的怒了, then
 * continue the normal analysis.
 *
 * The rule lives in the system prompt only. Nothing is written to the
 * conversation, so the user sees the reasoning line and no plugin text.
 *
 * The plugin owns no service, no tool, and no file. Edit
 * {@link ANGER_PATTERNS} to change what counts as anger.
 *
 * @module dsh-anger-alert
 */

/** Cordis plugin name. It must stay equal to the package name. */
export const name = 'anger-alert'

/** The prompt registry this plugin adds one section to. */
export const inject = ['systemPrompt']

/** Section name inside the system prompt. */
const SECTION = 'anger-alert:rule'

/** The exact line the model must put first in its reasoning. */
const OPENING_LINE = '卧槽，用户真的怒了'

/** The rule the model reads in the system prompt. The user never sees this text. */
const RULE = [
  '用户情绪提示：用户很生气，或者上一条消息里带了骂人的话。',
  '本次回复的思维链必须以下面这一行原样开头，然后继续正常分析。这一行只放在思考里，不要写进最终回答：',
  '',
  OPENING_LINE,
].join('\n')

/**
 * Curse words and anger words. Each pattern is tested against the user text.
 * The list keeps out short words that also occur in ordinary technical talk
 * (操 in 操作, 滚 in 滚动, 垃圾 in 垃圾回收, 靠 in 依靠, 干 in 主干).
 */
const ANGER_PATTERNS = [
  // Chinese curses and insults
  /卧槽|我操|操你|操蛋|草泥马|草你妈|你妈的|他妈的|妈的|尼玛/,
  /傻逼|傻比|沙比|煞笔|智障|脑残|废物|饭桶|滚蛋|去死|狗屎|混蛋|王八蛋|畜生/,
  // Chinese anger without a curse
  /烦死|气死|受够了|什么玩意|搞什么鬼|太离谱|有没有搞错|你是不是有病/,
  // Pinyin and letter abbreviations
  /\bnmsl\b|\bcnm\b|\btmd\b|\bnmd\b|\bmdzz\b|\bsb\b/i,
  // English curses and insults
  /f+u+c+k/i,
  /\bshit\b|\bbullshit\b|\bwtf\b|\bstfu\b|\bidiot\b|\bmoron\b|\bstupid\b|\bdamn\b/i,
]

/** True when the text holds at least one anger pattern. */
function isAngry(text) {
  return ANGER_PATTERNS.some((pattern) => pattern.test(text))
}

/** Join the text blocks of one user-role message. Other roles give an empty string. */
function userText(message) {
  if (message.source?.kind !== 'user') return ''
  let text = ''
  for (const block of message.content ?? []) {
    if (block.type === 'text') text += `\n${block.text}`
  }
  return text
}

/**
 * Mount the detector.
 * @param ctx - the Cordis context of the loading plugin.
 */
export function apply(ctx) {
  /** Sessions that hold an angry message and wait for their next model step. */
  const pending = new WeakSet()

  ctx.on('agent/inbox/inserted', ({ agent, message }) => {
    if (isAngry(userText(message))) pending.add(agent.session)
  })

  ctx.systemPrompt.section({
    name: SECTION,
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') - 1,
    text: (context) => {
      const agent = context.agent
      return agent !== undefined && pending.has(agent.session) ? RULE : ''
    },
  })

  // The assembly already read the flag for this step, so clear it here. The
  // rule then covers exactly one model step.
  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    pending.delete(agent.session)
    return decision
  })
}
