# 部门数字员工门户(一期)

飞书机器人:在群里置顶一张「大厅卡」,点「打开门户」后,按决策 0001 把一张个人门户卡(卡片 JSON 2.0)私聊发给点击人。门户支持四个分类切换、搜索、翻页、Skill 就地展开详情。一期不含路由智能体(二期)。

## 运行

```
cp .env.example .env   # 填好各项
npm install
npm run dev            # 启动机器人服务(长连接),看到 `portal bot ready` 即就绪
npm run lobby          # 发送大厅卡到 PORTAL_CHAT_ID 并置顶
npm test
```

**同一应用同一时间只能有一个长连接客户端**:启动 `npm run dev` 前,先停掉其他正在跑的连接进程(包括 spikes 脚本)。

## .env 各项

| 变量 | 含义 |
|---|---|
| FEISHU_APP_ID / FEISHU_APP_SECRET | 飞书自建应用凭证(不要提交 .env) |
| PORTAL_CHAT_ID | 放置大厅卡的群 chat_id |
| DEPT_NAME / DEPT_INTRO | 部门名称与简介 |
| ROUTER_LINK | 路由/咨询入口链接,可留空 |
| CATALOG_APP_TOKEN / CATALOG_TABLE_ID | 目录多维表格的 app_token 与 table_id |
| PROMO_TABLE_ID | 运营位数据表 table_id(与目录同一个 Base) |
| PERSONAL_DELIVERY | `p2p`(私聊,当前结论)或 `ephemeral`(群内仅自己可见),见 `docs/decisions/0001-personal-portal-delivery.md` |

## 飞书应用配置

- 权限(scopes):`im:message:send_as_bot`、`im:chat.top_notice:write_only`、`bitable:app:readonly`、`im:resource`、`im:chat.members:read`
- 回调:`card.action.trigger`;事件:`im.message.receive_v1`、`application.bot.menu_v6`,订阅方式均选「长连接」
- 机器人菜单:新增「打开门户」,event_key 填 `open_portal`
- 多维表格:应用按当前共享设置直接读取,无需把应用加为协作者;若以后收紧共享,需把应用加为 Base 协作者
- 可用范围:目前仅开发者本人可用,正式推广前需放大应用可用范围

## 触发方式

私聊机器人发「门户」(或 portal)、群里 @机器人 发「门户」、点机器人菜单「打开门户」、点大厅卡「打开门户」,都会调出门户。事件可能被飞书重投,服务内做了去重,一次指令只发一张卡。

## 更新大厅卡

重新运行 `npm run lobby`:会发送新卡并置顶,旧的置顶卡随之被替换。运营位以此时的数据为准(过期的不再显示)。

## 一期不含

路由智能体(二期)、多部门、门户卡的数据写入。验收清单见 `docs/acceptance/phase1.md`。
