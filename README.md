# 部门数字员工门户(一期)

飞书机器人:在群里置顶一张「大厅卡」,点「打开门户」后,按决策 0001 把一张个人门户卡(卡片 JSON 2.0)私聊发给点击人。门户支持四个分类切换、搜索、翻页、Skill 就地展开详情。一期不含路由智能体(二期)。

## 把门户交给另一个 Aily

把 [Aily 技能 ZIP](aily/sales-portal.zip) 发给目标智能体，按[交接指南](docs/aily-handoff.md)保存人设、试用演示并绑定正式能力目录。需要原版置顶和交互卡时，继续按本文配置飞书机器人服务。

## 下载后先生成卡片

使用 Node.js 24。在仓库根目录运行：

```sh
npm ci
npm run cards:preview
npm test
npm run typecheck
```

`npm run cards:preview` 读取 `data/seed-catalog.json`，用正式发卡代码生成大厅卡和数字员工、Skill、知识库、团队服务四张门户卡的 JSON，输出到 `dist/cards/`。可以修改种子目录，或用 `DEPT_NAME`、`DEPT_INTRO` 环境变量覆盖预览标题和简介。预览无需 `.env`，不会访问飞书或发送消息。没有本应用的图片键时会用内置图标并省略头图。目录里的示例链接用于演示卡片结构，真机联调前请换成有效 AppLink 和资源链接。

## 接入飞书测试应用

1. 配置下文的飞书应用权限、事件和菜单。让应用加入测试群，并确认它能读取目标 Base。
2. 在同一个 Base 准备「能力目录」和「运营位」两张表。「能力目录」按[字段定义](docs/superpowers/plans/2026-11-04-dept-agent-portal-phase1.md#task-2-目录数据模型与记录解析)建表，可参考 `data/seed-catalog.json` 填入记录。「运营位」可先留空，但需要有表 ID。使用运营位时，字段为「标题」「说明」（文本）、「跳转链接」（超链接）、「图片」（附件）、「开始时间」「结束时间」（日期）、「排序」（数字）、「上架」（复选框）。
3. 运行 `cp -n .env.example .env && chmod 600 .env`，按下表填写应用凭证、两张表的 ID 和测试群 ID。用同一套凭证运行 `npm run banners`，将仓库内附的成品图片上传到自己的应用并生成 `data/banner-keys.json`。图片键由上传应用使用，这个生成文件仅保存在本地。上传后也可重新运行预览命令，导出带图片键的卡片。
4. 先停掉同一个应用已有的长连接进程（包括 spikes 脚本），再运行 `npm run dev`。看到 `portal bot ready` 后，在另一个终端运行 `npm run lobby`，它会向 `PORTAL_CHAT_ID` 发卡并置顶。随后从测试群点击分类入口或「打开门户」，验证私聊收卡和卡内回调。

默认 `npm test` 不连接飞书。可选的 `INTEGRATION=1 npm test` 依赖原测试表的固定数据：目录与种子一致，运营位包含指定的在期记录和带附件的过期记录，并会向测试应用上传附件。新建的空运营位表可先用步骤 4 验证收卡和回调。

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
- 多维表格:按目标 Base 的共享设置给测试应用读取权限，必要时将应用添加为 Base 协作者
- 可用范围:测试时覆盖获准的测试人员，正式推广前再调整

## 触发方式

私聊机器人发「门户」(或 portal)、群里 @机器人 发「门户」、点机器人菜单「打开门户」、点大厅卡「打开门户」,都会调出门户。事件可能被飞书重投,服务内做了去重,一次指令只发一张卡。

## 更新大厅卡

重新运行 `npm run lobby`:会发送新卡并置顶,旧的置顶卡随之被替换。运营位以此时的数据为准(过期的不再显示)。

## 一期不含

路由智能体(二期)、多部门、门户卡的数据写入。验收清单见 `docs/acceptance/phase1.md`。
