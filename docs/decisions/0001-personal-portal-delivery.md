# 0001 个人门户投递方式:私聊(p2p)

- 日期:2026-11-04
- 状态:已采纳
- 结论:`PERSONAL_DELIVERY=p2p`

## 背景

点大厅卡「打开门户」后,要给点击人一张只有他能看到、可翻页/搜索的门户卡。两种投递方式:

- **ephemeral**:`POST /open-apis/ephemeral/v1/send`,在群里发「仅对你可见」的卡,人不用离开群。
- **p2p**:机器人私聊发卡,人要切到和机器人的单聊。

## 验证方法

`spikes/ephemeral-v2.ts` 同一次运行发两张一样的卡片 2.0(`interactive_container`、`collapsible_panel`、callback 按钮、带 `behaviors` 的独立 `input`),回调值里用 `v` 区分投递方式:

| 方式 | message_id | 发送结果 |
|---|---|---|
| ephemeral(测试群) | `om_x100b61876a3db450cfda59244581a1a` | `code=0` |
| p2p(机器人私聊) | `om_x100b61876bdd30a8ce415b3f0621c1c` | `code=0` |

测试人在飞书客户端里点两张卡;处理器把原始事件逐行写进 `spikes/out/callbacks.ndjson`(不入库)。

## 结果

| 项 | ephemeral | p2p |
|---|---|---|
| (a) 卡片 2.0 组件正常渲染 | 发送成功;未收到任何交互 | ✅ |
| (b) 点按钮后就地更新 + toast | ❌ 0 次回调 | ✅ 8 次回调,全部返回新卡,无报错 |
| (c) 群里其他人看不到 | 未验证(测试群只有测试人和机器人) | 天然满足(单聊) |
| (d) 输入框提交同时带 `action.value` 和 `action.input_value` | — | ✅ `input_value="kk"`,`action.value={"a":"spike","v":"p2p","w":"input"}` |
| (e) 事件字段实际路径 | — | 见下 |

p2p 卡上「整块区域」「按钮」「输入框回车」都触发了回调;折叠面板展开/收起是客户端行为,不产生回调(符合预期)。早先实现者冒烟时发出的那张 p2p 卡(`om_x100b61876cc934acb4fb0fcd6464ee4`)在新进程上也照常回调,说明回调跟着应用走、不跟发卡的进程走。

ephemeral 卡 0 次回调,原因未定位:可能是临时卡在客户端不持久(发出数小时后才去点,可能已看不到),也可能是临时卡对卡片 2.0 回调的支持有限。计划规定 (a)(b)(c) 必须全过才选 ephemeral,所以不再追查。

### (e) `card.action.trigger` 事件字段(长连接,schema 2.0)

```
operator.open_id          点击人 open_id
context.open_chat_id      卡片所在会话
context.open_message_id   卡片消息 id
action.value              按钮/容器/输入框的 callback 值(对象)
action.input_value        仅输入框提交时出现
action.tag                "button" / "interactive_container" / "input"
action.name               组件 name
host                      "im_message"
```

事件里**没有会话类型(p2p/group)字段**。门户只在 `PORTAL_CHAT_ID` 一个群里放大厅卡,所以 Task 7 用 `open_chat_id === PORTAL_CHAT_ID ? 'group' : 'p2p'` 推出 `chatType`。在 `PERSONAL_DELIVERY=p2p` 下 `chatType` 不影响投递去向(总是私聊点击人)。

## 结论与影响

- `PERSONAL_DELIVERY=p2p`:个人门户总是私聊发给点击人,toast 提示「已在私聊打开门户」。
- 代价:点击人要从群切到机器人单聊。好处:门户卡在单聊里持久存在、换设备也在,可以反复回来用。
- 回退:`Deliverer` 两种方式都实现;若以后确认临时卡可用,改 `.env` 的 `PERSONAL_DELIVERY=ephemeral` 即可,不用改代码。
