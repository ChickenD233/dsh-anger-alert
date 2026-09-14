# dsh-anger-alert

DSH 插件：用户生气或骂人时，让模型在思考过程里先喊一句。

A tiny DeepSeek Harness plugin. When a user message is angry or holds a curse
word, the model opens its reasoning with one fixed line.

命中之后，模型本次回复的思考会以这一行开头，然后继续正常分析：

```
卧槽，用户真的怒了
```

零依赖，一个文件，一个监听点。

## 安装

```bash
dsh plugin --profile web add github:ChickenD233/dsh-anger-alert
```

从本地目录装：

```bash
dsh plugin --profile web add /path/to/dsh-anger-alert
```

装完重启网关，再刷新浏览器页面。

## 工作原理

插件只挂一个监听点：`agent/pre-step`。

1. 取值：本步要进入模型的用户消息。
2. 匹配：跑一遍 `ANGER_PATTERNS` 关键词。
3. 注入：命中就追加一条 `plugin` 来源的 `notice` 消息，内容是一条指令。

这条 `notice` 会记进会话记录，在界面上显示为一行折叠的上下文，不会打扰用户。

关键点在最后一步：让模型自己写那句话的只有提示词。插件无法直接往思考流里塞字，
所以它做的是把关键词判断变成确定性的，再把措辞交给模型。

## 改关键词

关键词表在 `lib/index.js` 顶部的 `ANGER_PATTERNS`。改完重启网关生效。

表里故意不放短词，因为它们在正常技术交流里太常见：

| 不收 | 原因 |
| --- | --- |
| 操 | 操作、操场 |
| 滚 | 滚动、滚轮 |
| 垃圾 | 垃圾回收 |
| 靠 | 依靠、靠谱 |
| 干 | 主干、干预 |

## 已知限制

- 触发点是用户按下发送之后，不是还在打字的时候。打字阶段就要有反应，需要另写一个
  客户端插件去监听输入框。
- 那句话由模型写，不是插件写。模型偶尔可能不照做。指令里已经写明「不要写进最终回答」。
- 只匹配 `source.kind === 'user'` 的消息。模型自己的回复带脏话不会触发。

## 开发

没有构建步骤，也没有运行时依赖。

```bash
node test/smoke.mjs
```

测试覆盖 9 项：命中、未命中、去重、英文脏话、notice 结构。

## 许可

MIT
