/**
 * dsh-anger-alert — angry-user detector for the DeepSeek Harness.
 *
 * When a user message shows anger or holds a curse word, the plugin appends one
 * logged notice to that step. The notice orders the model to open its reasoning
 * with the fixed line 卧槽，用户真的怒了, then continue the normal analysis.
 *
 * The plugin owns no service, no tool, and no state. It listens to
 * `agent/pre-step` only. Edit {@link ANGER_PATTERNS} to change what counts as
 * anger.
 *
 * @module dsh-anger-alert
 */

/** Cordis plugin name. It must stay equal to the package name. */
export const name = 'anger-alert'

/** Label stamped on the injected notice, so the plugin can skip its own message. */
const PLUGIN = 'anger-alert'

/** The exact line the model must put first in its reasoning. */
const OPENING_LINE = '卧槽，用户真的怒了'

/**
 * The model-facing notice. A user-role message carries it, because the loop
 * admits model-visible context through the logged channels only.
 */
const NOTICE_TEXT = [
  '情绪提示：用户现在很生气，或者这条消息里带了骂人的话。',
  '',
  '规则：本次回复的思考过程必须以下面这一行原样开头，然后继续正常分析：',
  '',
  OPENING_LINE,
  '',
  '这一行只放在思考里，不要写进最终回答。',
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

/** Bound on a `notice` summary, copied from the harness message contract. */
const SUMMARY_MAX_CHARS = 120

/** Build the logged notice that orders the fixed opening line. */
function notice() {
  const summary = `用户怒了：思考先喊「${OPENING_LINE}」`
  // The message shape matches `createUserMessage` from @deepseek-ai/dsh-llm, so
  // this plugin keeps zero runtime dependencies.
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: NOTICE_TEXT }],
    source: {
      kind: 'plugin',
      plugin: PLUGIN,
      form: 'notice',
      summary: summary.length > SUMMARY_MAX_CHARS ? `${summary.slice(0, SUMMARY_MAX_CHARS - 1)}…` : summary,
    },
  }
}

/**
 * Mount the detector.
 * @param ctx - the Cordis context of the loading plugin.
 */
export function apply(ctx) {
  ctx.on('agent/pre-step', async ({ messages, signal }, next) => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    // A retry of the same step must not add the notice a second time.
    if (decision.messages.some((message) => message.source?.plugin === PLUGIN)) return decision
    if (!messages.some((message) => isAngry(userText(message)))) return decision
    return { ...decision, messages: [...decision.messages, notice()] }
  })
}
