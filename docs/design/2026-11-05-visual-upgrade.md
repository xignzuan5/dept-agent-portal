# 门户卡片视觉升级(一期改版)设计说明

- 日期:2026-11-05
- 来源:业务方验收意见「样式太素、不大气、不专业」;两份独立评审(Fable、GPT-6-Astra,原文在 `.superpowers/sdd/2026-11-04-dept-agent-portal-phase1/design-review/`)+ 卡片搭建工具实机预览截图。
- 业务方已定的方向:
  1. 配图换成**企业级深蓝哑光 3D**:物件为主,不出现人物、机器人、卡通脸。
  2. 大厅卡数量指标改成**四个可点的入口格**:2×2,点了直达该分类。
  3. 条目图标**每个分类一个**。

## 设计原则

- **一屏只有一个视觉焦点。** 大厅卡的焦点是品牌头图,门户卡的焦点是条目列表。运营位降级为横条,不再出现第二张通栏大图。
- **颜色分主次。**
  - 标题用墨色,正文和辅助信息用灰色,边框用细线。
  - 蓝色只用于主按钮、当前分类和少数状态标签。
  - 紫色(accent)只用于 Skill 和「新上线」。
  - 主色系不超过 2 个。
- **用面和线做卡片,不用蓝色描边。**
- **间距只用 4 / 8 / 12 三档。** 磁贴内标题和简介之间 2–4px,磁贴之间 8px,区块之间 12px。
- **没意义的 UI 不渲染。** 单页时不显示翻页,搜索态不显示分类图,不重复显示数量。
- **禁止:**
  - 镭射或彩虹配色、emoji 标题;
  - 没有真实数据的图表或表格;
  - 给所有条目都挂「热门」;
  - 带文字的图片;
  - 一屏两张大插画。

## 色板(`config.style.color`,全部给 light/dark 两套值)

| token | light | dark | 用途 |
|---|---|---|---|
| `cus-primary` | rgba(30,120,255,1) | rgba(80,150,255,1) | 主色文字 / 强调 |
| `cus-primary-bg` | rgba(30,120,255,0.08) | rgba(80,150,255,0.14) | 主色浅底 |
| `cus-ink` | rgba(31,35,41,1) | rgba(235,238,242,1) | 标题墨色 |
| `cus-muted` | rgba(100,106,115,1) | rgba(150,155,163,1) | 正文、辅助信息 |
| `cus-surface` | rgba(245,247,250,1) | rgba(255,255,255,0.06) | 卡片面 |
| `cus-line` | rgba(31,35,41,0.08) | rgba(255,255,255,0.12) | 细线边框 |
| `cus-accent` | rgba(102,78,255,1) | rgba(160,140,255,1) | Skill、新上线 |
| `cus-accent-bg` | rgba(102,78,255,0.08) | rgba(160,140,255,0.16) | 运营横条底 |

`cus-primary-border` 不再使用,删除。

字号在 `config.style.text_size` 新增 `title`:default/pc 用 `heading-3`,mobile 用 `heading-4`。区块标题(如「热门数字员工」)用它,不要用 `**粗体**` 冒充标题。

## 图片素材(Task 12 产出)

| 键 | 文件 | 比例 / 尺寸 | 用途 |
|---|---|---|---|
| `brand` | `assets/banners/brand.png` | 2:1 · 1200×600 | 大厅头图 |
| `category.<cat>` | `assets/banners/cat-<cat>.png` | **4:1** · 1200×300 | 门户分类矮条 |
| `promoDefault` | `assets/banners/promo-default.png` | **1:1** · 480×480 | 运营横条缩略图兜底 |
| `icons.<cat>` | `assets/icons/<cat>.png` | 1:1 · 256×256 透明 | 分类图标:入口格、磁贴、Skill 面板头 |

所有图片都由本应用上传换取 `img_key`。`data/banner-keys.json` 新增 `icons: { agent, skill, kb, service }`。缺少任一键时取 `null`,对应位置退回原来的 `standard_icon`,不报错。

## 大厅卡(共享,置顶)

从上到下:

1. **header**
   - `template: blue`,title 用部门门户名,subtitle 用 `DEPT_INTRO`。
   - **删掉** text_tag_list 里的数量标签。
2. **品牌头图**:2:1,`margin: "-12px -12px 0px -12px"`,与 header 贴合,消除现在的 12px 白缝。
3. **四个入口格**:两个 `column_set`,每个 2 列,`flex_mode: none`,列宽 `weighted`。
   - **每格**是一个 `interactive_container`:
     - 样式:`background_style: cus-surface`,`has_border: true`,`border_color: cus-line`,`corner_radius: 10px`,`padding: 12px`。
     - 点击:`behaviors: [{type: callback, value: {v:1, a:"open_portal", cat:"<cat>"}}]`。
   - **格内内容:**
     - 第一行:分类图标(img `size: small`,或 div 的 `custom_icon`)+ **分类名**(墨色加粗)+ 数量(灰色)。
     - 第二行:一句话,caption 灰色。
   - **一句话文案(固定):**

     | 分类 | 文案 |
     |---|---|
     | 数字员工 | 帮你干活的 AI 同事 |
     | Skill | 即装即用的销售技能 |
     | 知识库 | 产品、报价、案例一处查 |
     | 团队服务 | 审批与售前支持 |

4. **主按钮**「打开门户」:`primary_filled`,`width: fill`,`size: large`。点击值保持 `{v:1, a:"open_portal"}`,即打开数字员工分类。
5. **「热门数字员工」区块**
   - 标题行是一个 `column_set`:左边 `markdown text_size: title`;右边 `button type: text size: small`,文案「全部 N 个 →」,点击 `{v:1, a:"open_portal", cat:"agent"}`。
   - 下面是 4 张新样式磁贴(见「磁贴」一节)。
6. **运营横条**(仅当有生效中的运营位时显示):
   - 外层是 `interactive_container`:有跳转链接时为 `open_url`;没有链接时用 `column_set`,不可点。
   - 样式:`background_style: cus-accent-bg`,`corner_radius: 10px`。
   - 内部 `column_set`:
     - 左列:1:1 缩略图(`img`,`scale_type: crop_center`,固定小尺寸,具体取值以 `components/img.md` 为准,约 64–80px,`corner_radius: 8px`)。优先用运营位自己的图,没有则用 `promoDefault`。
     - 右列:`<text_tag color='violet'>新上线</text_tag>` 加 **标题**,下一行是说明(caption 灰色)。

## 个人门户卡(私聊,就地更新)

1. **header**
   - title 与大厅一致。
   - subtitle:浏览时为「{分类名} · {本分类条目数} 项 · 你的专属门户」,搜索时为「{分类名} · 搜索“{q}” · {命中数} 项」。
   - text_tag_list:一个当前分类标签。数字员工用 blue,Skill 用 violet,知识库和团队服务用 neutral。
   - 「仅你可见」字样全部删除,门户现在改为私聊投递。
2. **分类矮条**:4:1,`margin: "-12px -12px 0px -12px"`。**只在第 1 页且没有搜索词时显示。**
3. **分类切换**:一行 4 列。当前分类用 `primary_filled`,其余用 `type: text`,`size: small`,`horizontal_spacing: 0px`。标签固定为「数字员工 / Skill / 知识库 / 团队服务」。
4. **搜索框**:`input` 直接放在 body,不再套蓝底容器。placeholder 为「在{分类名}中搜索名称、简介或标签」,回调行为不变。
5. **列表**:每页 8 条,用新样式磁贴;Skill 分类用新样式面板。
6. **翻页**:只在 `totalPages > 1` 时渲染。两端按钮用 `type: text`,中间页码用 `cus-muted`。
7. **空结果**:一行灰字「没有找到相关内容,换个关键词试试」。保留现有的清空搜索入口(如果有)。

## 磁贴(数字员工 / 知识库 / 团队服务)

- **外层**
  - 有链接时是 `interactive_container`,`open_url` 打开链接。
  - 样式:`background_style: cus-surface`,`has_border: true`,`border_color: cus-line`,`corner_radius: 10px`,`padding: 12px`。
- **内部**:一个 `column_set`(`flex_mode: none`,`horizontal_spacing: 12px`)。
  - **左列** `width: auto`:分类图标,img `size: small`,`corner_radius: 8px`;缺图标时用原来的 `standard_icon`。
  - **右列** `weighted 1`,`vertical_spacing: 2px`,依次为:
    - `**<font color='cus-ink'>名称</font>**`;
    - 简介:caption,`cus-muted`;
    - 标签:全部用 `<text_tag color='neutral'>`,最多 2 个。
- **去掉负责人 `person`**(大厅和门户都去掉)。
- **无链接时**:不可点,外层用同样的面和线(`column_set` + column 的 `background_style: cus-surface`);简介下加一行灰字「链接未配置」。

## Skill 面板

- **`collapsible_panel`**
  - `header.title`:只放 `**名称**`。
  - `header.icon`:Skill 分类图标(`custom_icon` img_key);缺图标时不放。
  - `header.background_color: cus-surface`;`border: {color: cus-line, corner_radius: 10px}`。
- **展开后依次是:**
  1. 简介:caption 灰色;
  2. 「查看文档」:`button type: primary size: small`,仅在有链接时出现;
  3. 详情:markdown,先把「【xx】」转成独立一行的 `**xx**`;
  4. 标签:neutral。
- **不放负责人。**
- **详情长度上限:** 首档 400 字,超出部分截断并以「…完整说明见文档」结尾。整页超预算时继续按 `400 → 200 → 80 → 0` 收缩。

## 交互变化

- `open_portal` 回调值可带可选的 `cat`(合法分类)。`decodeAction` 返回 `{v:1, a:'open_portal', cat?}`,非法 `cat` 视为没带。
- `openPortal` 接收可选的初始分类,默认 `agent`。

## 预算

- 大厅卡与门户卡都必须 ≤200 元素、≤28KB,门户卡按「Skill 页 8 条且详情最长」的情况计算。
- 现有 `src/cards/budget.ts` 的门限不变,超预算时按 Skill 详情收缩规则处理。
