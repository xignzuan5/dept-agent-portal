# 部门数字员工门户 · 一期 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一期交付「多维表格能力目录 + 群置顶大厅卡 + 点「打开门户」后仅本人可见的个人版门户卡(分类切换、搜索、翻页、agent 跳 aily、skill 就地展开、知识库跳转)」,并能用私聊指令和机器人菜单随时调出门户。

**Architecture:** 一个 Node/TypeScript 机器人服务,经官方 SDK 的 WebSocket 长连接接收卡片回调与消息事件(本地开发无需公网地址;SDK 会把处理器返回值原样回传平台,因此回调可在 3 秒内直接返回新卡片实现就地切换)。目录从多维表格读取、内存缓存 60 秒;所有卡片由纯函数从目录条目生成卡片 2.0 JSON,便于单测。

**Tech Stack:** Node 24、TypeScript(`tsx` 运行)、`vitest`、`@larksuiteoapi/node-sdk@1.76.0`、`dotenv`;建表与造数用 `lark-cli`(用户身份,见 lark-base skill)。

**Spec:** `/Users/xingzuan/work/dept-agent-portal/ai-native/intake/dept-agent-portal-card.intent.md`
一期 = 范围(in) 中的「能力目录」「群大厅卡」「个人版门户卡(不含输入框直接问路由)」「随时调出门户」。**不在一期**:路由 agent(两个入口)、改表后主动更新已发出的卡片、大厅卡 14 天自动重发、使用统计。
**2026-11-04 追加进一期**:数字员工链接用机器人 AppLink(Task 3);Banner——品牌头图、分类主题图、运营位(Task 5、Task 8、Task 9)。执行顺序见 SDD 台账:5 → 6 → 8 → [人工 T0] → 1b → 3b → 9 → 7。
**与需求的有意偏差**:需求里的「标签筛选下拉」并入搜索(搜索同时匹配标签),一期不单独做下拉;条目按一行一个磁贴纵向排列(两列网格在手机上会挤压),不做多列网格。

## Global Constraints

- 卡片一律 `"schema": "2.0"`,`config.update_multi: true`(2.0 只有共享模式)。
- 单卡组件+元素 ≤ 200;单卡 JSON ≤ 30KB(UTF-8 字节),本项目以 ≤ 28KB 为门限留余量。
- 卡片回调必须 3 秒内返回;回调处理器内只读缓存,不得等待无缓存的多维表格全量读取。
- `element_id`:字母开头,仅字母数字下划线,≤ 20 字符,卡内唯一。
- `collapsible_panel` 内不放 `form`;`interactive_container` 内不放 `form`/`table`,且 `behaviors` 必填。
- 视觉过 `~/.agents/skills/lark-im/references/card/lark-im-card-style.md` 的 P0–P7;颜色走 `config.style.color` 的 light/dark token。
- 分类与标签固定:`agent`=数字员工、`skill`=Skill、`kb`=知识库、`service`=团队服务;顺序即此顺序。
- 每页条目数 `PAGE_SIZE = 8`;目录缓存 `TTL = 60_000` ms(支撑「改表后新打开的门户卡 1 分钟内体现」)。
- 用**专用飞书应用**,不复用 lark-cli 的 `cli_aa90f1abeab81cc6`:长连接为集群模式,同一应用只有一个客户端收到事件,会和 `lark-cli event consume` 抢事件。
- 用户可见文案用中文。
- Banner 图片:PNG,≤ 10MB、≤ 1500×3000px、高:宽 ≤ 16:9;本项目每张压到 ≤ 1MB。`img_key` 必须由**发卡片的那个应用**上传(`POST /open-apis/im/v1/images`,`image_type=message`)取得;图内不含文字。比例:品牌头图 2:1、分类主题图 4:1、运营图 3:1;通栏用负边距(见 `components/img.md`)。
- 数字员工的链接约定为机器人 AppLink:前缀 `https://applink.feishu.cn/client/bot/open?appId=`。

## Review Focus

1. **目录为空 / 某分类 0 条** → 显示「这个分类还没有登记条目」,分类按钮仍可切换。(Task 5 测试)
2. **条目缺链接或链接不是 `http(s)://`** → 渲染为不可点的块并显示灰字「链接未配置」,整卡照常发送。(Task 2、Task 4 测试)
3. **超长文本 / 条目极多**(简介 200 字、详情 5000 字、10 个标签,8 条同页)→ 截断后整卡仍 ≤ 200 组件、≤ 28KB。(Task 5 测试)
4. **过期或损坏的回调**(条目被删后翻页越界、无法解析的 value)→ 页码夹到有效范围;无法解析则 toast「卡片已过期,请重新打开门户」。(Task 5、Task 6 测试)
5. **多维表格读不到** → 用上次成功的缓存;从未成功过则 toast「目录暂时读不到,请稍后再试」,仍在 3 秒内返回;并发点击共享同一次读取。(Task 3、Task 6 测试)

---

### Task 0: 专用飞书应用与测试群(需要人在开发者后台操作)

**Files:** Create `.env`(不提交)

- [ ] **Step 1:** 在飞书开发者后台创建企业自建应用「部门数字员工门户」,开启机器人能力。
- [ ] **Step 2:** 开通以下接口所需权限(以各接口文档标注的 scope 为准):发送消息 `POST /im/v1/messages`、发送仅特定人可见卡片 `POST /ephemeral/v1/send`、群置顶 `POST /im/v1/chats/:chat_id/top_notice/put_top_notice`、读取多维表格记录 `GET /bitable/v1/apps/:app_token/tables/:table_id/records`。
- [ ] **Step 3:** 事件与回调 → 订阅方式选「使用长连接接收」;事件订阅 `im.message.receive_v1`、`application.bot.menu_v6`;回调订阅 `card.action.trigger`。
- [ ] **Step 4:** 机器人自定义菜单加一项「打开门户」,类型为推送事件,`event_key = open_portal`。
- [ ] **Step 5:** 发布版本;把机器人拉进测试群;用 `lark-cli im +chat-search` 查出测试群 `chat_id`(`oc_…`)和测试者自己的 `open_id`(`ou_…`)。
- [ ] **Step 6:** 写 `.env`:`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`PORTAL_CHAT_ID`、`SPIKE_OPEN_ID`、`DEPT_NAME`、`DEPT_INTRO`,`ROUTER_LINK` 留空(二期路由上线后再填)。

---

### Task 1: 项目脚手架 + 技术验证(临时卡片是否支持卡片 2.0、长连接回调能否返回新卡片)

**Files:**
- Create: `package.json`、`tsconfig.json`、`.gitignore`(含 `.env`、`node_modules`)、`.env.example`、`vitest.config.ts`
- Create: `spikes/ephemeral-v2.ts`
- Create: `docs/decisions/0001-personal-portal-delivery.md`

**Interfaces:**
- Produces: 环境变量 `PERSONAL_DELIVERY=ephemeral|p2p`(本任务的结论),供 Task 7 的 `loadConfig` 读取。

- [ ] **Step 1:** `git init`;`npm init -y`;`package.json` 设 `"type": "module"`,scripts:`"test": "vitest run"`、`"dev": "tsx src/bot/main.ts"`、`"lobby": "tsx scripts/send-lobby.ts"`;安装 `@larksuiteoapi/node-sdk@1.76.0 dotenv`,dev 依赖 `typescript tsx vitest @types/node`。`tsconfig` 用 `"module": "NodeNext"`、`"strict": true`。
- [ ] **Step 2:** 写 `spikes/ephemeral-v2.ts`:启动 `WSClient`,用 `POST /open-apis/ephemeral/v1/send`(`client.request`)向 `PORTAL_CHAT_ID` 给 `SPIKE_OPEN_ID` 发一张卡片 2.0(含 `interactive_container`、`collapsible_panel`、一个 callback 按钮 `{a:"spike"}`、一个带 `behaviors` callback 的独立 `input`);注册 `card.action.trigger` 处理器,返回 `{ toast: { type: "success", content: "已更新" }, card: { type: "raw", data: <同一张卡,header.subtitle 改为「第 N 次点击」> } }`,并把收到的原始事件 `console.log` 出来。
- [ ] **Step 3:** 运行 `npx tsx spikes/ephemeral-v2.ts`,在飞书里核对并记录:(a) 卡片带「仅对你可见」且 2.0 组件都正常渲染;(b) 点按钮后卡片就地更新并弹 toast;(c) 群里其他成员看不到这张卡;(d) 在输入框提交后,日志里同时有 `action.value` 和 `action.input_value`;(e) 日志里事件字段的实际路径(`operator.open_id`、`context.open_chat_id`、`context.open_message_id`)。
- [ ] **Step 4:** 若 (a)(b)(c) 全过 → 结论 `PERSONAL_DELIVERY=ephemeral`;否则改为给 `SPIKE_OPEN_ID` 私聊发同一张卡,重测 (b),结论 `PERSONAL_DELIVERY=p2p`。把 (a)–(e) 的结果和结论写进 `docs/decisions/0001-personal-portal-delivery.md`,结论写入 `.env` 与 `.env.example`。
- [ ] **Step 5:** Commit:`git add -A && git commit -m "chore: scaffold and spike ephemeral card 2.0 delivery"`

---

### Task 2: 目录数据模型与记录解析

**Files:**
- Create: `src/catalog/types.ts`、`src/catalog/parse.ts`
- Test: `test/catalog/parse.test.ts`

**Interfaces:**
- Produces:
```ts
export type Category = 'agent' | 'skill' | 'kb' | 'service';
export const CATEGORIES: Category[];                       // ['agent','skill','kb','service']
export const CATEGORY_LABEL: Record<Category, string>;     // 数字员工 / Skill / 知识库 / 团队服务
export interface CatalogEntry {
  id: string; category: Category; name: string; summary: string; detail: string;
  tags: string[]; ownerOpenIds: string[]; link: string | null; order: number; hot: boolean;
}
export interface RawRecord { record_id: string; fields: Record<string, unknown> }
export function parseRecords(records: RawRecord[]): { entries: CatalogEntry[]; warnings: string[] };
```

多维表格字段 → 条目映射(字段名即表头,Task 3 按此建表):

| 字段 | 类型 | → |
|---|---|---|
| 类型 | 单选:数字员工 / Skill / 知识库 / 团队服务 | `category` |
| 名称 | 文本 | `name` |
| 一句话简介 | 文本 | `summary` |
| 详细说明 | 多行文本 | `detail` |
| 标签 | 多选 | `tags` |
| 负责人 | 人员 | `ownerOpenIds`(取每项 `id`) |
| 跳转链接 | 超链接 `{link,text}` | `link`(仅保留 `^https?://`,否则 `null` 并记 warning) |
| 排序 | 数字 | `order`(缺省 9999) |
| 热门 | 复选框 | `hot` |
| 上架 | 复选框 | 不为 `true` 的记录跳过 |

- [ ] **Step 1: 写失败测试** `test/catalog/parse.test.ts`:
  - `maps a full record`:一条字段齐全的「数字员工」记录 → 断言整条 `CatalogEntry` 等于期望值。
  - `accepts text fields as plain string or rich-text segments`:`名称` 为 `[{type:"text",text:"周报"},{type:"text",text:"助手"}]` → `name === "周报助手"`。
  - `skips unlisted, nameless and unknown-type records with a warning naming the record_id`:三条坏记录 → `entries.length === 0`,`warnings` 有 3 条且各含对应 `record_id`。
  - `nulls non-http links and warns`:`跳转链接.link = "javascript:alert(1)"` → `link === null`,warnings 含该 record_id。
  - `sorts by category order, then 排序, then 名称`。
- [ ] **Step 2:** Run `npx vitest run test/catalog/parse.test.ts` — Expected: FAIL(模块不存在)。
- [ ] **Step 3:** 实现 `src/catalog/types.ts` 与 `parseRecords`。
- [ ] **Step 4:** Run `npx vitest run test/catalog/parse.test.ts` — Expected: PASS。
- [ ] **Step 5:** Commit:`git add src test && git commit -m "feat: catalog model and record parser"`

---

### Task 3: 目录多维表格 + 读取与缓存

**Files:**
- Create: `data/seed-catalog.json`、`src/catalog/source.ts`
- Modify: `src/catalog/parse.ts`、`test/catalog/parse.test.ts`(数字员工链接须为机器人 AppLink)
- Test: `test/catalog/source.test.ts`、`test/catalog/source.integration.test.ts`

**Interfaces:**
- Consumes: `RawRecord`、`CatalogEntry`、`parseRecords`(Task 2)。
- Produces:
```ts
export class CatalogUnavailableError extends Error {}
export interface CatalogSource { get(): Promise<CatalogEntry[]> }
export function createCatalogSource(opts: {
  fetchAll: () => Promise<RawRecord[]>; ttlMs: number; now?: () => number;
}): CatalogSource;
export function baseFetcher(client: lark.Client, appToken: string, tableId: string): () => Promise<RawRecord[]>;
```

- [ ] **Step 1:** 用 lark-cli(用户身份,按 lark-base skill)新建多维表格「部门能力目录」,数据表「能力目录」,字段严格按 Task 2 映射表建;把门户应用加为该多维表格的协作者(可阅读)。把 `CATALOG_APP_TOKEN`、`CATALOG_TABLE_ID` 写入 `.env` / `.env.example`。
- [ ] **Step 2:** 写 `data/seed-catalog.json` 并用 lark-cli 批量写入:≥ 5 个数字员工(其中 2 个 `热门`)、≥ 5 个 Skill(其中 1 个详细说明 ≥ 1500 字)、2 个知识库、2 个团队服务、1 条缺跳转链接、1 条 `上架=false`;`负责人` 用真实 open_id(人员组件遇到无效 id 会导致整卡发送失败);数字员工的跳转链接一律用机器人 AppLink `https://applink.feishu.cn/client/bot/open?appId=cli_…`(真实的 aily 智能伙伴 App ID 由人提供,拿不到就用门户应用自己的 App ID 占位)。
- [ ] **Step 2b:** 在 `parseRecords` 中:`category === "agent"` 且 `link` 非空但不以 `https://applink.feishu.cn/client/bot/open?appId=` 开头 → 条目保留,记 warning「记录 <record_id> 的数字员工链接不是机器人 AppLink」。先写失败测试 `warns when an agent link is not a bot AppLink but keeps the entry`(另一用例:非 agent 的普通 https 链接不告警),跑红、实现、跑绿。
- [ ] **Step 3: 写失败测试** `test/catalog/source.test.ts`(注入假 `fetchAll` 与 `now`):
  - `serves cached entries within ttl without refetching`(60s 内两次 `get()`,`fetchAll` 调用 1 次)。
  - `refetches after ttl`。
  - `concurrent gets share one in-flight fetch`(同时 3 次 `get()`,`fetchAll` 调用 1 次)。
  - `returns last good entries when a refetch fails`。
  - `throws CatalogUnavailableError when the first fetch fails`。
- [ ] **Step 4:** Run `npx vitest run test/catalog/source.test.ts` — Expected: FAIL。
- [ ] **Step 5:** 实现 `createCatalogSource` 与 `baseFetcher`(用 `client.bitable.v1.appTableRecord.list` 按 `page_size: 500` 翻完所有页)。
- [ ] **Step 6:** Run `npx vitest run test/catalog/source.test.ts` — Expected: PASS。
- [ ] **Step 7:** 写 `source.integration.test.ts`(仅当 `INTEGRATION=1` 时运行):读真实表 → `parseRecords` 后条目数 = 种子中上架条数,warnings 只含那条缺链接的记录。Run `INTEGRATION=1 npx vitest run test/catalog/source.integration.test.ts` — Expected: PASS。
- [ ] **Step 8:** Commit:`git commit -m "feat: catalog base, seed data and cached source"`

---

### Task 4: 卡片基础件与大厅卡

**Files:**
- Create: `src/cards/budget.ts`、`src/cards/theme.ts`、`src/cards/tiles.ts`、`src/cards/lobby.ts`
- Test: `test/cards/tiles.test.ts`、`test/cards/lobby.test.ts`

**Interfaces:**
- Consumes: `CatalogEntry`、`CATEGORY_LABEL`(Task 2)。
- Produces:
```ts
// budget.ts
export const MAX_ELEMENTS = 200; export const MAX_BYTES = 28 * 1024;
export function countElements(card: object): number;  // 递归统计所有含 tag 键的对象
export function cardBytes(card: object): number;      // Buffer.byteLength(JSON.stringify(card))
// theme.ts
export function cardConfig(): object;                 // update_multi + text_size + light/dark color token
export const CATEGORY_ICON: Record<Category, string>; // standard_icon token,取自 resource/icons.md
// tiles.ts
export function entryTile(e: CatalogEntry): object;   // 数字员工 / 知识库 / 团队服务
export function skillPanel(e: CatalogEntry): object;  // Skill
// lobby.ts
export interface DeptInfo { name: string; intro: string; routerLink: string | null }
export function buildLobbyCard(entries: CatalogEntry[], dept: DeptInfo): object;
```

磁贴规格:有链接 → `interactive_container`(描边、圆角 8px,`behaviors: [{type:"open_url", default_url: link}]`),内含分类图标、**加粗名称**、灰色简介(截断到 60 字加「…」)、最多 3 个标签(markdown `<text_tag>`)、负责人 `person`(有 `ownerOpenIds` 时取第一个);无链接 → 同样内容放进普通 `column_set`,末尾灰字「链接未配置」。Skill 用 `collapsible_panel`(`expanded: false`),标题为「**名称** · 简介」,展开后显示详细说明(截断到 1500 字)、全部标签、负责人,有链接时再加一个「查看文档」`open_url` 按钮。

大厅卡规格:header 标题 `${dept.name}数字员工门户`、副标题 `dept.intro`、`template: "blue"`、标签「N 个数字员工 · M 个 Skill」;块 1 为四列指标(每个分类的数量 + 标签);块 2 为「热门数字员工」:`hot` 的 agent 最多 4 个,不足 4 个时按 `order` 用其余 agent 补齐,0 个则整块不渲染;块 3 为按钮:「打开门户」`primary_filled`、callback `{v:1,a:"open_portal"}`,`routerLink` 非空时加「问路由助手」`default` + `open_url`。

- [ ] **Step 1: 写失败测试**:
  - tiles:`linked entry is an interactive_container opening its link`;`unlinked entry is not clickable and shows 链接未配置`;`summary truncated to 60 chars with …`;`at most 3 tags shown`;`skill renders as collapsed collapsible_panel containing the detail`;`detail truncated to 1500 chars`。
  - lobby:`schema 2.0 with title and counts tag`;`shows up to 4 hot agents and backfills by order`;`has open_portal callback button`;`router button only when routerLink set`;`empty catalog renders zero counts and no hot section`;`lobby stays within MAX_ELEMENTS and MAX_BYTES`。
- [ ] **Step 2:** Run `npx vitest run test/cards` — Expected: FAIL。
- [ ] **Step 3:** 实现 `budget.ts`、`theme.ts`、`tiles.ts`、`lobby.ts`。
- [ ] **Step 4:** Run `npx vitest run test/cards` — Expected: PASS。
- [ ] **Step 5:** 用 lark-cli 以机器人身份把大厅卡发到测试群(`lark-cli im +messages-send --chat-id $PORTAL_CHAT_ID --msg-type interactive --content "$(npx tsx -e '…打印 buildLobbyCard(种子)…')"`),在 PC 与手机上目测,按 P0–P7 自检;不过就改了再发。
- [ ] **Step 6:** Commit:`git commit -m "feat: card building blocks and lobby card"`

---

### Task 5: 个人版门户卡

**Files:**
- Create: `src/cards/portal.ts`、`src/cards/banners.ts`
- Test: `test/cards/portal.test.ts`、`test/cards/banners.test.ts`

**Interfaces:**
- Consumes: `entryTile`、`skillPanel`、`cardConfig`、`countElements`、`cardBytes`、`DeptInfo`(Task 4);`CatalogEntry`、`CATEGORIES`、`CATEGORY_LABEL`(Task 2)。
- Produces:
```ts
export const PAGE_SIZE = 8;
export interface PortalView { category: Category; page: number; query: string } // page 从 0 开始
export function filterEntries(entries: CatalogEntry[], category: Category, query: string): CatalogEntry[];
export function buildPortalCard(entries: CatalogEntry[], view: PortalView, dept: DeptInfo, banners?: BannerKeys): { card: object; view: PortalView }; // 返回夹紧后的 view
// banners.ts
export interface BannerKeys { brand: string | null; category: Record<Category, string | null>; promoDefault: string | null }
export function bannerImg(imgKey: string, alt: string): object; // 通栏 img(crop_center、负边距撑满、preview:false)
```

布局:header「${dept.name} · 门户」、副标题「仅你可见 · 共 N 项」;`banners?.category[view.category]` 非空时,body 第一个元素为该分类主题图 `bannerImg(key, CATEGORY_LABEL[cat])`,为空则不渲染图片;分类切换为四个按钮一行(当前分类 `primary_filled`,其余 `default`),callback `{v:1,a:"nav",cat,page:0,q:""}`;搜索为独立 `input`(placeholder「搜索名称、简介或标签」,`default_value = view.query`,`behaviors: [{type:"callback", value:{v:1,a:"search",cat: view.category}}]`);列表区放当页条目(Skill 用 `skillPanel`,其他用 `entryTile`);底部翻页:「上一页」· 「第 p/N 页」·「下一页」,callback `{v:1,a:"nav",cat,page:p±1,q}`,首页禁用上一页、末页禁用下一页。查询匹配名称、简介、标签,忽略大小写,仅在当前分类内。

- [ ] **Step 1: 写失败测试**:
  - `current category button is primary_filled, others default`。
  - `paginates 8 per page`;`clamps an out-of-range page to the last page and returns the clamped view`。
  - `disables 上一页 on first page and 下一页 on last page`。
  - `search matches name, summary or tag case-insensitively within the category`。
  - `empty category shows 这个分类还没有登记条目`;`no match shows 没有找到和「x」相关的条目`。
  - `search input carries the current category in its callback value`。
  - `worst-case page stays within budget`:8 条同页、每条简介 200 字、详情 5000 字、10 个标签 → `countElements(card) <= MAX_ELEMENTS` 且 `cardBytes(card) <= MAX_BYTES`。
  - `element_ids are unique and match /^[A-Za-z][A-Za-z0-9_]{0,19}$/`。
  - `renders the current category's banner first when its key is set, and no img when it is null or banners is omitted`。
  - banners:`bannerImg is a full-bleed img with the given key and alt, preview disabled`。
- [ ] **Step 2:** Run `npx vitest run test/cards/portal.test.ts test/cards/banners.test.ts` — Expected: FAIL。
- [ ] **Step 3:** 实现 `bannerImg`、`filterEntries`、`buildPortalCard`。
- [ ] **Step 4:** Run `npx vitest run test/cards/portal.test.ts test/cards/banners.test.ts` — Expected: PASS。
- [ ] **Step 5:** 用 Task 4 Step 5 的方式把第 1 页 agent 和 Skill 两种视图各发一张到测试群,按 P0–P7 自检。
- [ ] **Step 6:** Commit:`git commit -m "feat: personal portal card with tabs, search and paging"`

---

### Task 6: 回调动作解码与处理

**Files:**
- Create: `src/bot/actions.ts`、`src/bot/handlers.ts`
- Test: `test/bot/handlers.test.ts`

**Interfaces:**
- Consumes: `CatalogSource`、`CatalogUnavailableError`(Task 3);`buildPortalCard`、`PortalView`(Task 5);`DeptInfo`(Task 4)。
- Produces:
```ts
// actions.ts
export type PortalAction =
  | { v: 1; a: 'open_portal' }
  | { v: 1; a: 'nav'; cat: Category; page: number; q: string }
  | { v: 1; a: 'search'; cat: Category };
export function decodeAction(value: unknown): PortalAction | null; // 接受对象或 JSON 字符串;字段不合法返回 null
// handlers.ts
export interface Deliverer {
  personalPortal(target: { chatId: string; openId: string; chatType: 'p2p' | 'group' }, card: object): Promise<{ via: 'ephemeral' | 'p2p' }>;
}
export interface HandlerDeps { catalog: CatalogSource; dept: DeptInfo; deliver: Deliverer }
export interface CardActionInput { operatorOpenId: string; chatId: string; chatType: 'p2p' | 'group'; value: unknown; inputValue?: string }
export interface CallbackResult {
  toast?: { type: 'info' | 'success' | 'error' | 'warning'; content: string };
  card?: { type: 'raw'; data: object };
}
export function handleCardAction(evt: CardActionInput, deps: HandlerDeps): Promise<CallbackResult>;
export function openPortal(target: { chatId: string; openId: string; chatType: 'p2p' | 'group' }, deps: HandlerDeps): Promise<CallbackResult>;
```

行为:`open_portal` → `openPortal`:用 `{category:"agent",page:0,query:""}` 建卡并 `deliver.personalPortal`,投递超过 2000ms 视为失败;成功时 toast success,按 `via` 分别为「门户已发给你(仅你可见)」/「已在私聊打开门户」。`nav` → 返回 `card`(用夹紧后的 view)。`search` → view 为 `{category: cat, page: 0, query: inputValue ?? ""}`,返回 `card`。解码失败 → toast warning「卡片已过期,请重新打开门户」。`CatalogUnavailableError` → toast error「目录暂时读不到,请稍后再试」。投递失败 → toast error「门户发送失败,请稍后再试」。

- [ ] **Step 1: 写失败测试**(假 `catalog`、假 `deliver`):
  - `decodeAction accepts object and JSON string, rejects unknown a / bad cat / negative page`。
  - `open_portal delivers a portal card to the operator and toasts by delivery route`(ephemeral / p2p 两个用例)。
  - `nav returns a raw card for the requested category and page`。
  - `nav past the last page returns the last page`。
  - `search uses inputValue as query within the given category`。
  - `undecodable value returns 卡片已过期 warning toast`。
  - `catalog unavailable returns 目录暂时读不到 error toast`。
  - `delivery slower than 2000ms returns 门户发送失败 error toast`。
- [ ] **Step 2:** Run `npx vitest run test/bot/handlers.test.ts` — Expected: FAIL。
- [ ] **Step 3:** 实现 `decodeAction`、`handleCardAction`、`openPortal`。
- [ ] **Step 4:** Run `npx vitest run test/bot/handlers.test.ts` — Expected: PASS。
- [ ] **Step 5:** Commit:`git commit -m "feat: card action decoding and handlers"`

---

### Task 7: 服务接线、指令/菜单、大厅卡发送与置顶、端到端验收

**Files:**
- Create: `src/config.ts`、`src/bot/deliver.ts`、`src/bot/main.ts`、`scripts/send-lobby.ts`、`README.md`、`docs/acceptance/phase1.md`
- Test: `test/config.test.ts`、`test/bot/intent.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `PERSONAL_DELIVERY`;Task 3 的 `createCatalogSource`、`baseFetcher`;Task 4/8 的 `buildLobbyCard`(含 `LobbyExtras`);Task 6 的 `handleCardAction`、`openPortal`、`Deliverer`、`CardActionInput`;Task 9 的 `loadBannerKeys`、`createPromoSource`。门户卡与大厅卡都要传入 `BannerKeys`(门户卡经 `HandlerDeps` 带入:给 `HandlerDeps` 增加可选字段 `banners?: BannerKeys`,`openPortal`/`nav`/`search` 构卡时透传),大厅卡另传当前 `promos`。
- Produces:
```ts
// config.ts
export interface PortalConfig {
  appId: string; appSecret: string; catalogAppToken: string; catalogTableId: string;
  portalChatId: string; dept: DeptInfo; personalDelivery: 'ephemeral' | 'p2p';
}
export function loadConfig(env: Record<string, string | undefined>): PortalConfig; // 缺项时抛错,错误信息列出全部缺失键
// deliver.ts
export function createDeliverer(client: lark.Client, mode: 'ephemeral' | 'p2p'): Deliverer;
// main.ts 内部
export function isPortalCommand(text: string): boolean; // 去掉 @ 提及后 trim,等于「门户」或忽略大小写等于 "portal"
```

- [ ] **Step 1: 写失败测试**:`loadConfig lists every missing key`;`loadConfig maps ROUTER_LINK empty to null`;`isPortalCommand accepts 门户 / Portal / "@_user_1 门户", rejects 门户呢`。
- [ ] **Step 2:** Run `npx vitest run test/config.test.ts test/bot/intent.test.ts` — Expected: FAIL。
- [ ] **Step 3:** 实现 `loadConfig`、`isPortalCommand`;`createDeliverer`:`chatType === "p2p"` 或 `mode === "p2p"` → `client.im.v1.message.create`(`receive_id_type: "open_id"`),否则 `POST /open-apis/ephemeral/v1/send`。
- [ ] **Step 4:** Run 同上 — Expected: PASS。
- [ ] **Step 5:** 实现 `main.ts`:启动时 `await catalog.get()` 预热缓存;`WSClient` + `EventDispatcher.register`:`card.action.trigger` → 按 Task 1 记录的字段路径组装 `CardActionInput` → `handleCardAction` → 返回结果;`im.message.receive_v1` → 私聊里文本命中 `isPortalCommand`,或群里 @机器人且命中 → `openPortal`(群里用 ephemeral 投递);`application.bot.menu_v6` 且 `event_key === "open_portal"` → 私聊 `openPortal`。
- [ ] **Step 6:** 实现 `scripts/send-lobby.ts`:读目录 → `buildLobbyCard` → 机器人发到 `PORTAL_CHAT_ID` → 调 `put_top_notice` 把这条消息设为群置顶 → 打印 `message_id`。
- [ ] **Step 7:** 运行 `npm test`,Expected:全部 PASS(集成测试默认跳过)。
- [ ] **Step 8: 端到端验收**:`npm run dev` 起服务,`npm run lobby` 发大厅卡,在 `docs/acceptance/phase1.md` 逐条记录 通过/失败:
  1. 群置顶出现大厅卡,四个指标数量与表格上架条数一致。
  2. 点「打开门户」→ 收到仅自己可见的门户卡(或按决策收到私聊)+ toast;另一位群成员看不到。
  3. 四个分类切换、搜索、翻页都就地更新,每次 3 秒内有响应。
  4. 点任意一个数字员工磁贴 → 打开对应 aily 对话;知识库磁贴 → 打开对应链接;缺链接的条目显示「链接未配置」。
  5. Skill 点开就地展开详情。
  6. 私聊发「门户」、群里 @机器人「门户」、点机器人菜单「打开门户」都能调出门户。
  7. 在多维表格新增一条上架记录 → 60 秒后重新打开门户能看到它。
  8. 两人同时在群里打开并操作各自的门户,互不影响。
  9. 大厅卡顶部是品牌头图、指标下方是运营位(点击跳到配置的链接);门户卡切换四个分类时,顶部主题图跟着换;PC、手机、深色模式下 banner 与 `cus-*` 颜色都正常显示。
  10. 把运营位的结束时间改到过去 → 重新 `npm run lobby` 后不再显示该运营位。
- [ ] **Step 9:** `README.md` 写清:`.env` 各项含义、`npm run dev` / `npm run lobby`、一期不含的能力。Commit:`git commit -m "feat: bot service wiring, lobby pinning and phase-1 acceptance"`

---

### Task 8: Banner 素材与大厅卡接入(品牌头图、运营位渲染)

**Files:**
- Create: `assets/banners/brand.png`(2:1)、`assets/banners/cat-agent.png`、`cat-skill.png`、`cat-kb.png`、`cat-service.png`(4:1)、`assets/banners/promo-default.png`(3:1)——由 controller 提供的 GPT 原图(1536×1024)用 PIL 居中裁切并压到 ≤ 1MB;裁切脚本 `scripts/crop-banners.py`
- Modify: `src/cards/banners.ts`、`src/cards/lobby.ts`
- Test: `test/cards/banners.test.ts`、`test/cards/lobby.test.ts`

**Interfaces:**
- Consumes: `BannerKeys`、`bannerImg`(Task 5);`buildLobbyCard`、`DeptInfo`、`cardConfig`、`countElements`、`cardBytes`(Task 4)。
- Produces:
```ts
// banners.ts
export interface Promo {
  id: string; title: string; subtitle: string; link: string | null; imgKey: string | null;
  start: number | null; end: number | null; order: number; // 毫秒时间戳;null 表示不限
}
export function activePromos(promos: Promo[], now: number): Promo[];          // start <= now < end,按 order 升序
export function promoBlock(p: Promo, fallbackImgKey: string | null): object | null; // 图与 fallback 都没有时返回 null
// lobby.ts
export interface LobbyExtras { banners?: BannerKeys; promos?: Promo[]; now?: number }
export function buildLobbyCard(entries: CatalogEntry[], dept: DeptInfo, extras?: LobbyExtras): object;
```

大厅卡加 banner 后的块顺序:品牌头图(`banners.brand` 非空时,body 第一个元素)→ 指标 → 运营位(仅 `activePromos` 的第一个)→ 热门数字员工 → 按钮。运营位块:有 `link` 时为 `interactive_container`(open_url),内含通栏图(`imgKey ?? fallbackImgKey`)+ **加粗标题** + 灰色说明(`cus-muted`);无 `link` 时同样内容但不可点击。不传 `extras` 时输出与 Task 4 完全相同(既有测试不改)。

- [ ] **Step 1:** 写 `scripts/crop-banners.py`(Python 3 + PIL,`python3 -I` 运行):读 controller 给的原图目录,按上面比例居中裁切、缩到宽 1200px、存 PNG 并压到 ≤ 1MB,输出到 `assets/banners/`。运行并确认 6 张图的尺寸与体积(`sips -g pixelWidth -g pixelHeight`、`ls -la`)。
- [ ] **Step 2: 写失败测试**:
  - banners:`activePromos keeps only promos whose window contains now, sorted by order`(含未开始、已结束、两端为 null 的用例);`promoBlock with link is clickable and opens it`;`promoBlock without link is not clickable`;`promoBlock falls back to the default image and returns null when neither exists`。
  - lobby:`brand banner is the first body element when set`;`no img when banners omitted (output equals Task 4 output)`;`shows only the first active promo`;`expired promo is not shown`;`lobby with banner and promo stays within MAX_ELEMENTS and MAX_BYTES`。
- [ ] **Step 3:** Run `npx vitest run test/cards` — Expected: FAIL。
- [ ] **Step 4:** 实现 `activePromos`、`promoBlock`、`LobbyExtras` 与大厅卡改动。
- [ ] **Step 5:** Run `npx vitest run test/cards` — Expected: PASS;再跑 `npm test`、`npm run typecheck`。
- [ ] **Step 6:** 预览:用 `lark-cli im images create --as bot --data '{"image_type":"message"}' --file <png>` 上传 6 张图拿 img_key(只用于预览,不提交),构造带头图 + 运营位的大厅卡,以及 agent / skill 两个分类的门户卡,发到用户私聊(同 Task 4 的发送方式),记录 message_id。
- [ ] **Step 7:** Commit:`git add assets scripts src test && git commit -m "feat: banners for lobby and portal cards"`

---

### Task 9: 运营位表、图片上传与 banner key(需要门户应用)

**Files:**
- Create: `scripts/upload-banners.ts`、`data/banner-keys.json`(脚本产物,提交)、`src/catalog/promos.ts`
- Test: `test/catalog/promos.test.ts`、`test/catalog/promos.integration.test.ts`

**Interfaces:**
- Consumes: `RawRecord`(Task 2);`Promo`、`BannerKeys`(Task 5/8);`createCatalogSource` 的缓存语义(Task 3,照同样的 TTL / 最长等待 / onError 规则实现)。
- Produces:
```ts
export function loadBannerKeys(path: string): BannerKeys;   // 文件不存在或缺项 → 对应字段为 null,不抛错
export interface PromoRecord extends Omit<Promo, 'imgKey'> { imageToken: string | null }
export function parsePromoRecords(records: RawRecord[]): { promos: PromoRecord[]; warnings: string[] };
export function createPromoSource(opts: {
  fetchAll: () => Promise<RawRecord[]>;
  resolveImage: (fileToken: string) => Promise<string>; // 附件 file_token → IM img_key,结果按 file_token 缓存
  ttlMs: number; maxWaitMs?: number; onError?: (err: unknown) => void;
}): { get(): Promise<Promo[]> };
```

「运营位」表字段:标题(文本)、说明(文本)、图片(附件,可选)、跳转链接(超链接)、开始时间(日期)、结束时间(日期)、排序(数字)、上架(复选框)。`上架` 不为 true 或缺标题 → 跳过并告警;链接规则同目录(仅 http(s))。图片转换失败 → 该运营位 `imgKey = null`(渲染时用默认运营图)并 `onError`,不影响其他运营位。

- [ ] **Step 1:** `scripts/upload-banners.ts`:用门户应用(`.env` 的 FEISHU_APP_ID/SECRET)把 `assets/banners/` 6 张图以 `image_type=message` 上传,写 `data/banner-keys.json`(`{brand, category:{agent,skill,kb,service}, promoDefault}`)。运行它。
- [ ] **Step 2:** 用 lark-cli(用户身份)在「部门能力目录」多维表格里新建数据表「运营位」(字段如上),写入 1 条生效中的示例(标题「新上线:周报助手」、跳转到种子里的一个数字员工 AppLink、无图片)和 1 条已过期的;`PROMO_TABLE_ID` 写入 `.env` / `.env.example`。
- [ ] **Step 3: 写失败测试**:`loadBannerKeys returns nulls for a missing file`;`parsePromoRecords maps fields, converts dates to ms and skips unlisted/titleless records with warnings`;`promo source resolves each image token once and caches it`;`an image that fails to resolve yields imgKey null and calls onError`。
- [ ] **Step 4:** Run `npx vitest run test/catalog/promos.test.ts` — Expected: FAIL。
- [ ] **Step 5:** 实现 `loadBannerKeys`、`parsePromoRecords`、`createPromoSource`,以及真实的 `resolveImage`:`GET /open-apis/drive/v1/medias/:file_token/download` 下载附件 → `POST /open-apis/im/v1/images` 上传得 img_key。
- [ ] **Step 6:** Run `npx vitest run test/catalog/promos.test.ts` — Expected: PASS;`INTEGRATION=1 npx vitest run test/catalog/promos.integration.test.ts` 读真实「运营位」表,Expected:只返回生效中的那 1 条。
- [ ] **Step 7:** Commit:`git add scripts src test data .env.example && git commit -m "feat: promo table, banner upload and keys"`
