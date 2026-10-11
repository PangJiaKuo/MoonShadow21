# 月影二十一 · Moonshadow 21

多人在线「魔改 21 点」卡牌游戏：2-8 人同台对局，支持本地热座、人机对战、房间码联机与筹码积分赛。

> 神秘 · 复古 · 蒸汽朋克 + 塔罗牌风格。深色背景、金色描边、卡牌翻转动画、水彩复古塔罗卡面插画。

---

## 一、功能总览

| 模块 | 说明 |
|---|---|
| 核心引擎 | 54+2 张牌（4 花色 × 13 + 皇帝 + 皇后）、洗牌/发牌/抽牌/停牌/爆牌/结算/黑杰克，纯函数可测试 |
| 特殊卡系统 | 23 张原创特殊卡（《创始系列》10 张 + 《书院奇谈》13 张），效果结算引擎（策略模式），每张卡独立单元测试 |
| 本地热座 | 2-8 人同屏轮流操作，可选人数与昵称，无需后端 |
| 人机对战 | 单机挑战 AI，AI 自动决策（抽牌/停牌/设点/使用特殊卡） |
| 联机对战 | 6 位房间码 + 可选密码，2-8 人在线对战，服务器权威、断线重连（座位保留 60 秒） |
| 积分赛 | 筹码押注模式（2-8 人通用）：底注 / 停牌加注 / 唯一胜者赢奖池 / 币尽出局 |
| 用户系统 | 注册（昵称+密码）、登录、会话 token、对局胜利发金币 |
| 卡组与商城 | 每人独立 52 张卡组（4 花色 × 13），商城购买特殊卡后装备替换同点数牌，对局从个人卡组抽牌且不重复 |
| 卡面插画 | 23 张特殊卡水彩复古塔罗卡面（海大特色、OUC 徽记）+ 4 张花色朴素底图，开发者可换图 |
| 音效与音乐 | 全局背景音乐（无缝循环、支持本地选曲与音量调节）、停牌/爆牌自动停牌音效 |
| Android APK | Capacitor 封装 + GitHub Actions 自动构建单机版 APK |

## 二、技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 · TypeScript · Vite · TailwindCSS · Framer Motion · Zustand |
| 后端 | Node.js · TypeScript · Express · Socket.IO（服务器权威） |
| 数据库 | SQLite（`node:sqlite`，开发期免安装）→ PostgreSQL（部署期） |
| 测试 | Vitest（引擎）+ node:test（服务端） |
| 部署 | 前端 Vercel · 后端 Railway/Fly.io |

## 三、目录结构（monorepo）

```
.
├── package.json          # npm workspaces 根（shared / engine / client / server）
├── tsconfig.base.json    # 共享 TS 配置
├── .github/workflows/    # GitHub Actions（APK 自动构建）
├── shared/               # 前后端共享类型（@moon21/shared）
│   └── src/types.ts      # 卡牌 / 玩家 / 对局 / 动作 / 特殊卡 / 决策类型
├── engine/               # 核心游戏引擎（@moon21/engine，纯 TS 可测）
│   ├── src/
│   │   ├── cards.ts        # 基础牌定义、点数规则
│   │   ├── deck.ts         # Fisher-Yates 洗牌、抽牌
│   │   ├── game.ts         # 对局状态机、动作、结算、特殊卡集成
│   │   ├── specialCards.ts # 23 张特殊卡数据（SPECIAL_CARDS + SPECIAL_BY_ID）
│   │   └── effects.ts      # 效果引擎：触发 / 结算 / 决策（策略模式）
│   └── test/             # Vitest 单元测试（含每张特殊卡 ≥1 用例）
├── client/               # React 前端（@moon21/client）
│   ├── public/
│   │   ├── cards/         # 特殊卡卡面插画 + 花色底图（jpg）
│   │   └── audio/         # bgm.mp3（循环音乐）、stand.wav（停牌音效）
│   └── src/
│       ├── store/         # Zustand 对局状态（本地/联机分支）、登录态
│       ├── net/           # socket.ts（联机指令与重连）、api.ts（REST）
│       ├── audio/         # 背景音乐 / 音效控制（音量、本地选曲）
│       ├── cardArt.ts     # 卡面插画映射（CARD_ART / SUIT_ART，开发者可改）
│       ├── isNative.ts    # Capacitor 原生环境检测（APK 单机版隐藏联机入口）
│       └── components/    # 菜单 / 大厅 / 对战桌 / 卡牌 / 决策框 / 登录注册 / 卡组 / 商城
└── server/               # 后端（@moon21/server）
    ├── src/index.ts      # Express + Socket.IO：房间系统、服务器权威对局、金币发放
    ├── src/db.ts         # SQLite：users / cards / user_cards / decks 表（启动自动建表 + 同步卡牌）
    ├── src/auth.ts       # scrypt 哈希、会话 token、认证路由
    ├── src/collection.ts # 卡牌数据 / 收藏 REST API
    ├── src/shop.ts       # 卡组 / 商城 REST API
    ├── src/reward.ts     # 对局胜利金币发放（纯逻辑，可测）
    └── test/             # node:test（db + reward + deckShop）
```

## 四、快速开始

前置：Node.js ≥ 20。

```bash
# 1. 安装依赖（仓库根目录）
npm install

# 2. 启动后端（联机 / 登录 / 商城必需；纯热座与人机可跳过）
npm run dev:server        # http://localhost:4000/health

# 3. 启动前端
npm run dev:client        # http://localhost:5173
```

浏览器打开 `http://localhost:5173`：

- **本地热座**：主菜单「热座对战」，选择人数（2-8）并填写昵称，直接开始，无需后端。
- **人机对战**：主菜单「人机对战」，填写昵称即可（可开关特殊卡），无需后端。
- **在线对战**：点击「创建房间」→ 选人数（2-8）、模式与密码 → 生成 6 位房间码发给朋友；朋友输入房间码「加入房间」。全员「准备」后房主「开始对局」。刷新页面自动重连恢复座位。
- **积分赛**：创建房间时模式选「积分赛（筹码）」，热座 / 人机开局前亦可勾选开启。

### 验证命令

```bash
npm run test              # 全部单元测试（引擎 Vitest + 服务端 node:test）
npm run test -w engine    # 仅引擎（规则 + 特殊卡）
npm run test -w server    # 仅服务端
npm run typecheck         # 全部包类型检查（TS 严格模式）
npm run build             # 前端生产构建（client/dist/）
```

## 五、玩法规则

### 基础规则

- 牌堆 54 张：太阳 ☀ / 月亮 🌙 / 星辰 ⭐ / 花朵 🌸 各 13 张 + 皇帝、皇后各 1 张。
- 数字牌 A=1、2-10 面值；人头牌 J=11、Q=12、K=13。
- 皇帝 / 皇后可当作 0-13 任意点数（行动前须设定，可关闭打纯基础局）。
- 目标：点数总和尽量接近 21 且不超过 21；恰好 21 为黑杰克。
- 开局每人 1 张暗牌（对对手保密、自己可见），此后摸牌立即翻开（含特殊卡）。
- 轮流行动：抽牌（Hit）/ 停牌（Stand）。点数超过 21 不立即判负，而是自动停牌，等结算统一揭晓。
- 全部停牌后统一结算；点数最接近 21 且未爆者获胜；同分平局。
- **每人只能看到自己的总点数**，对手仅显示状态（行动中 / 等待中 / 停牌）。

### 多人模式（按入座人数自动选择，房主可手动指定）

- **2 人 · 对赌**：经典对赌，轮流坐庄。
- **3-4 人 · 积分制**：每局赢家 +1 分，先到 3 分获胜。
- **5-8 人 · 淘汰制**：爆牌或点数最低者出局。
- **积分赛（筹码）**：初始每人 10 币；每轮自动投 1 币底注；停牌后可在加注弹窗自定义加注（不超过持有币数）；唯一胜者赢得本轮全部奖池（输家失去本轮投入）；平局均分奖池（余数滚存）；全员爆牌奖池滚存；币尽者出局，仅剩 1 人时整场获胜。

### 特殊卡系统

- 特殊卡不洗入基础牌堆：登录玩家在**商城**（100 金币/张）购买 → 进入「已拥有特殊卡」区 → 在**卡组**页点击「装备」替换卡组中一张**同点数**的牌，才进入个人卡组。对局中从**个人卡组**抽牌且**不重复**。
- 本地热座 / 人机开启特殊卡时，将全部 23 张一并加入双方个人卡组以便体验。
- 摸到 OnDraw 特殊卡时**视情况发动，可选手不使用**；需要选择时引擎产出 `pending` 决策，前端弹出模态框（背景不模糊，点数始终可见），提交 `resolveChoice` 后继续。
- 点击手牌中的特殊卡可查看技能详情。
- 稀有度：普通 / 稀有 / 史诗 / 传说（前端以不同描边颜色区分）。

#### 《创始系列》（10 张）

| 卡 | 稀有度 | 触发 | 效果 |
|---|---|---|---|
| 银月 | 传说 | OnDraw | 将此牌点数设为 1-5 |
| 蒸汽核心 | 史诗 | OnDraw | 手牌全为太阳花色时设为 9 或 10 |
| 替身 | 稀有 | OnDraw | 与上一家一张暗牌互换 |
| 命运硬币 | 稀有 | OnDraw | 弃一张手牌并重抽一张 |
| 沉默 | 史诗 | Passive | 上一家特殊卡效果无效 |
| 双生 | 传说 | OnDraw | 拆成两张点数减半的牌 |
| 回溯 | 稀有 | OnStand | 停牌时弃一张重抽（仍停牌） |
| 赌徒 | 史诗 | OnDraw | 声明加倍：未爆则总点数×2，爆则出局 |
| 守夜人 | 传说 | OnCompare | 上一家 21 点时强制其重抽 |
| 皇帝密令 | 史诗 | OnDraw | 点数固定 13，本回合必须抽牌 |

#### 《书院奇谈》（13 张，校园主题）

| 卡 | 稀有度 | 触发 | 效果 |
|---|---|---|---|
| 笔记 | 普通 | OnDraw | 点数任选 1-3 |
| 食堂 | 普通 | OnDraw | 手牌 ≥3 张时点数 0/2/4 |
| 闹钟 | 普通 | OnStand | 弃自己，抽 1 张后必须停 |
| 选修课 | 稀有 | OnDraw | 点数选 2-5 或 8-11 |
| 社团 | 稀有 | OnDraw | 与上一家一张暗牌互换 |
| 室友 | 稀有 | Passive | 50% 概率使上一家特殊卡效果无效 |
| 小组作业 | 稀有 | OnDraw | 弃 1 张并重抽 1 张 |
| 通宵 | 史诗 | OnStand | 弃自己，令上一家弃 1 重抽 1 |
| 奖学金 | 史诗 | OnDraw | 自动再抽 1 张，未爆则总点数×2 |
| 论文 | 史诗 | OnDraw | 全手牌点数 +1 或 -1（最低 1 点） |
| 保研 | 传说 | OnDraw | 点数任选 1-13 |
| 退学 | 传说 | OnDraw | 弃自己，移除上一家 1 张亮牌 |
| 毕业 | 传说 | OnDraw | 点数自动补为「21 − 其余手牌点数」（非正取 0） |

> 「上一家」= 座位顺时针前一位玩家。

## 六、联机系统

- **房间机制**：创建生成 6 位房间码（去易混字符），可设密码，可选人数（2-8）；大厅显示玩家与准备状态，支持离开房间。
- **服务器权威**：服务端持有 `GameState`，客户端只发 `game:action` 指令，服务端用引擎 `apply` 计算后广播全房间，非法动作被忽略，客户端无法篡改结果。
- **断线重连**：断线后座位保留 60 秒；客户端将 `roomCode + playerId` 存入 `localStorage`，刷新后自动 `room:rejoin` 恢复。

## 七、账号 · 卡组 · 商城

- **注册 / 登录**：主菜单右上角，仅需「昵称 + 密码」（密码 ≥4 位）。注册即自动建立默认 52 张卡组并发放全部特殊卡（去重）。登录态存于 `localStorage`，刷新自动恢复。
- **卡组**：主菜单「卡组」，展示你的 52 张基础牌与已装备的特殊卡；游客默认显示基础 52 张。
- **商城**：「商城」以 **100 金币**购买特殊卡，购买后进入「已拥有特殊卡」区（**不自动进卡组**）。
- **装备**：在「已拥有特殊卡」区点击「装备」选中特殊卡，再点击卡组中一张**同点数**的牌完成替换；也可替换同点数的已装备特殊卡。
- **对局胜利金币**：联机对局结束产生最终胜者时，胜者账号 +5 金币。

## 八、外观与音频

### 卡面插画

- 23 张特殊卡均有水彩复古塔罗风格卡面（`client/public/cards/<defId>.jpg`），映射表在 `client/src/cardArt.ts` 的 `CARD_ART`。
- 4 张花色朴素底图（sun / moon / star / flower）映射在 `SUIT_ART`。
- 换卡面：直接替换 `client/public/cards/` 对应图片，或在 `cardArt.ts` 修改路径（仅开发者配置，玩家无自助入口）。

### 音乐与音效

- 背景音乐：`client/public/audio/bgm.mp3`（60s 无缝循环）；桌面上「♪」按钮可**选择本地音乐**（浏览器本地文件）并**调节音量**，音量记忆在 `localStorage`（`moon21_bgm_volume`）。
- 停牌 / 爆牌自动停牌共用音效：`client/public/audio/stand.wav`。
- 音频控制逻辑在 `client/src/audio/sound.ts`、`client/src/components/MusicControl.tsx`。

## 九、开发

### 引擎设计

- `apply(game, action)` 为纯函数：返回新 `GameState`，不可变、可重放、可测试。
- 洗牌、发牌、结算、特殊卡效果全在引擎完成（服务器权威前置）。
- 随机源可注入（`createGame(names, config, { rng })`），便于确定性测试。
- 效果引擎 `engine/src/effects.ts`：`HANDLERS` 按 `EffectType` 分发，`processUnresolvedDraw / handleOnStand / handleOnCompare` 在正确时机触发，`resolveDecision` 结算玩家选择（决策目标经 `payload` 传递）。

### 如何添加新特殊卡

1. 在 `engine/src/specialCards.ts` 的 `SPECIAL_CARDS` 中新增一项（`id / name / rarity / baseValue / effect{trigger,type,params} / description`）。
2. 全新效果类型：在 `engine/src/effects.ts` 增加 handler 并注册到 `HANDLERS`，在 `shared/src/types.ts` 的 `EffectType` 补充类型。
3. 若需要玩家选目标/选点数，在 handler 中产出 `pending` 决策（选项带 `payload` / `value`）。
4. 在 `engine/test/` 新增该卡单元测试（触发时机 + 结算 + 边界）。
5. 服务端 `seedCards` 会自动把新卡同步进 `cards` 表（商城 / 图鉴 / 注册发放），无需改 server 代码。
6. 运行 `npm run test` 与 `npm run typecheck` 验证。
7. 可选：生成卡面图放入 `client/public/cards/<defId>.jpg` 并在 `cardArt.ts` 登记。

## 十、构建 Android APK（Capacitor + GitHub Actions）

前端为 React + Vite 网页应用，用 Capacitor 封装为 Android App，由 GitHub Actions 自动构建：

1. **本地手动构建**（需 Android SDK + JDK 17）：
   ```bash
   cd client
   npm run build            # 先构建 web 产物到 dist
   npx cap sync android
   cd android && ./gradlew :app:assembleDebug
   # APK 输出：client/android/app/build/outputs/apk/debug/app-debug.apk
   ```

2. **GitHub Actions 自动构建**：`.github/workflows/build-apk.yml`，推送 `main` 或手动 `workflow_dispatch` 触发；自动完成 npm ci → 构建前端 → cap sync → assembleDebug；产物以 artifact `moon21-apk` 上传。

> **当前 APK 为单机版**：原生环境（`client/src/isNative.ts` 检测 `window.Capacitor`）隐藏联机 / 登录 / 卡组 / 商城 / 收藏入口，仅保留热座（2-8 人）与人机对战。后端部署到公网后，将联机地址写入 `VITE_SERVER_URL` / `VITE_API_URL` 重新构建即可启用联机，并移除对应 `!native` 隐藏逻辑。

## 十一、后续规划

- 阶段 5：锦标赛模式、轮抽模式、Roguelike 单机
- 阶段 6：卡包与开包动画、卡背 / 桌布 / 特效外观、扩展卡包
- 部署：后端 SQLite → PostgreSQL，联机环境上公网（Railway/Fly.io）

## 十二、版权

所有卡牌名称、系列名均为原创（《创始系列》《书院奇谈》），卡面为原创生成插画，不涉及任何第三方作品专有名词。
