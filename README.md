# Aether · 极简导航工作台

克制、耐看的个人导航站点。视觉规范还原 Figma 确认稿（Bento 分类托盘 + 悬浮胶囊顶栏 + 聚光灯搜索），桌面与移动端自适应。

**纯前端架构**：浏览器通过 PocketBase SDK 直连后端，仓库内没有任何自建服务进程。数据、鉴权、图标文件全部托管在 PocketBase。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_GITHUB_USER%2FYOUR_REPO&env=VITE_PB_URL&envDescription=PocketBase%20instance%20URL%2C%20e.g.%20https%3A%2F%2Fpb.example.com&project-name=aether-nav&repository-name=aether-nav)

> 上面按钮里的 `YOUR_GITHUB_USER/YOUR_REPO` 需要替换成你自己的仓库路径（推送到 GitHub 后就固定了）。
> 点按钮后 Vercel 会引导你填 `VITE_PB_URL`，见下方「部署到 Vercel」。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite 6 |
| 数据 / 鉴权 | PocketBase（HTTP API + JS SDK）|
| 图标 | Lucide Icons（线性）|
| 包管理 | pnpm 11（`packageManager` 固定 `pnpm@11.28.9`）|

## 快速开始

```bash
pnpm install

# 1) 配置连接信息
cp .env.example .env
#    编辑 .env：填 VITE_PB_URL / PB_ADMIN_* / PB_EDITOR_*

# 2) 在 PocketBase 上建表（幂等，可重复执行）
pnpm setup

# 3) 启动前端
pnpm dev          # http://localhost:5199
```

生产构建：

```bash
pnpm build        # 产物在 dist/，可托管到任意静态服务
pnpm preview      # 本地预览构建产物
```

## 环境变量

PocketBase 的 API 地址**完全由环境变量决定**，代码里没有任何硬编码地址。

| 变量 | 用途 | 何时需要 | 是否打进前端产物 |
| --- | --- | --- | --- |
| **`VITE_PB_URL`** | **PocketBase 实例地址**（前端运行时的唯一 API 入口） | 运行 / 构建前端 | ✅ 是（Vite 构建时内联） |
| `PB_URL` | 同上，供建表脚本使用 | `pnpm setup` | ❌ |
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | PocketBase 超管账号 | `pnpm setup` | ❌ |
| `PB_EDITOR_EMAIL` / `PB_EDITOR_PASSWORD` | 要创建的管理态账号（仅初始密码） | `pnpm setup` | ❌ |
| `PB_PREFIX` | 集合名前缀，默认 `aether_` | `pnpm setup` | ❌ 需与 `src/api/pocketbase.ts` 常量一致 |
| `PB_SEED` | `false` 时跳过种子数据 | `pnpm setup` | ❌ |

> `VITE_` 前缀是 Vite 的约定：只有带此前缀的变量会被注入浏览器包。其余变量只在本地建表脚本里用一次，不参与构建。
>
> 修改 `VITE_PB_URL` 后**必须重新构建**（或重启 `pnpm dev`）——它是构建时内联的，不是运行时读取。

未配置时页面不会白屏，而是显示「尚未配置 PocketBase 地址」的提示。

## 部署到 Vercel

1. 把仓库推送到 GitHub。
2. 把 README 顶部按钮里的 `YOUR_GITHUB_USER/YOUR_REPO` 换成实际路径，或直接在 Vercel 里 **Add New → Project → Import Git Repository**。
3. Vercel 会自动识别 Vite（Build Command `pnpm build`，Output Directory `dist`）。
   仓库里的 `vercel.json` 已显式声明这三项，避免检测偏差。
   > pnpm 版本由 `package.json` 的 `packageManager` 决定（当前 `pnpm@11.28.9`）。
   > **不要回退到 `pnpm@11.13.0`**——该版本是官方确认的坏发布（`@pnpm/exe` 里没带二进制），
   > 会导致 Vercel 构建直接失败：`pnpm v11.13.0 is a broken release and cannot be installed`。
4. 在 **Settings → Environment Variables** 添加：

   | Key | Value | 环境 |
   | --- | --- | --- |
   | `VITE_PB_URL` | 你的 PocketBase 地址，如 `https://pb.example.com` | Production / Preview / Development |

5. 点 **Redeploy**（环境变量只在下一次构建生效）。

建表脚本**不需要**在 Vercel 上跑——它只在本地执行一次，把集合建到 PocketBase 上即可。

### ⚠️ 部署前必读：PocketBase 必须是 HTTPS

浏览器的混合内容策略会**拦截 HTTPS 页面发出的 HTTP 请求**。如果 PocketBase 仍然是
`http://<ip>:<port>`，那么部署到 Vercel（HTTPS）后前端**完全读不到数据**。

两种解法：

- 给 PocketBase 配一个 HTTPS 域名（Nginx/Caddy/Cloudflare 反代），然后把 `VITE_PB_URL` 设为 `https://pb.你的域名`；
- 或只在本机 / 内网用 HTTP 访问，不做公网部署。

## 建表脚本

`scripts/setup-pocketbase.mjs`（`pnpm setup`）会：

1. 超管登录；
2. 把历史无前缀集合**原地重命名**为目标名（保留记录与 id）；
3. `upsert` 四个集合与访问规则（保留系统字段，不会误删 `created`/`updated`）；
4. 确保站点品牌设置记录存在（**已有记录绝不覆盖**，你改过的标题/图标不会被重置）；
5. 创建管理态账号（已存在则跳过）；
6. `categories` 为空时写入 3 分类 / 12 站点种子数据。

幂等：重复执行只同步结构，不会重复建账号或写种子数据。

### 集合与权限

| 集合 | 类型 | 说明 |
| --- | --- | --- |
| `aether_editors` | **auth** | 管理态登录账号（PocketBase 原生认证表）；`createRule: null` 禁止匿名注册 |
| `aether_categories` | base | `name`、`sort_order` |
| `aether_links` | base | `category`(relation→categories, cascadeDelete)、`title`、`url`、`description`、`icon`(file)、`sort_order` |
| `aether_settings` | base | **单记录**：`site_title`(text/60)、`site_logo`(file)。站点标题与图标 |

- 读：`listRule` / `viewRule` = `""`（匿名可读，含图标文件）
- 写：`createRule` / `updateRule` / `deleteRule` = `@request.auth.id != ''`

> **集合名带 `aether_` 前缀**：同一个 PocketBase 实例可安全服务多个项目，不会与
> `categories` / `links` 这类通用名撞车。前缀由 `PB_PREFIX` 控制，**首次建表后不要再改**。

## 管理态与编辑者账号

先明确一件事：**编辑者的账号密码不需要写进代码、不需要打进前端产物、也不需要配到 Vercel。**
它是一条存在 PocketBase 数据库里的账号记录，谁要管理，谁在登录框里手输即可。

### 账号在哪

`aether_editors` 是一个 `type: auth` 集合（PocketBase 原生认证表），里面每条记录就是一个可登录账号，
存的是邮箱 + **哈希后的**密码。前端登录走：

```ts
pb.collection('aether_editors').authWithPassword(email, password)
```

### 账号怎么来（三个变量只在这里用一次）

`PB_EDITOR_EMAIL` / `PB_EDITOR_PASSWORD` **只被建表脚本读取一次**，用于创建这条记录：

```bash
# .env 里填好这两个值，然后跑一次
pnpm setup
```

脚本检测到该邮箱已存在就跳过，**不会覆盖你后来改过的密码**。

不跑脚本也行，直接在 PocketBase 后台手动建：
**Collections → `aether_editors` → New record**，填 email + password（至少 10 位）、勾上 `verified`。

### 生命周期对照

| 阶段 | 账号在哪 | 需要配什么 |
| --- | --- | --- |
| 本地首次建表 | `.env` 里的 `PB_EDITOR_*` → 脚本写入 PocketBase | `PB_URL` + `PB_ADMIN_*` + `PB_EDITOR_*` |
| 之后日常使用 | 只在 PocketBase 数据库里 | 什么都不用配，登录框手输 |
| 部署到 Vercel | 同上（PB 是独立的服务器） | **只需要 `VITE_PB_URL`** |
| 改密码 | 在 PocketBase 后台改 | 不用动代码、不用重新部署 |
| 加同事账号 | 同一集合再加一条记录 | 同上，写入规则天然放行 |

### 为什么 Vercel 上不用配账号密码

前端只负责把用户输入的邮箱密码发给 PocketBase 校验，**它本身不需要知道正确密码**。
把密码写进 `VITE_*` 变量反而会把它打包进 JS，任何访客打开 DevTools 都能看到——
那才是真正应该避免的做法。

### 登录保持多久

编辑者登录后**至少保持 30 天**，两层配合：

1. **服务端**：`aether_editors` 集合的 `authToken.duration` 设为 `2592000` 秒（30 天）。
   PocketBase 默认只有 5 天，这是之前"过几天就掉线"的原因。该值由建表脚本写入，可用
   `PB_AUTH_TOKEN_DAYS`（默认 `30`）调整，`pnpm setup` 重跑即生效且幂等：

   ```bash
   PB_AUTH_TOKEN_DAYS=60 pnpm setup   # 想更长可以调到 60
   ```

2. **前端**：页面加载时若 token 剩余不足 **7 天**，自动调 `authRefresh()` 换新 token。
   于是变成了滚动窗口 —— 只要 30 天内打开过一次，就不用重新登录。

想强制全员重新登录时，在 PocketBase 后台重置该集合的 `authToken.secret` 即可（所有旧 token 立即失效）。

### 前端流程

点「管理」→ 未登录则弹登录框 → 登录成功进入管理态 → 可增删改分类与站点。
登录态存于 `localStorage`（`pocketbase_auth`），刷新后保持；点登出图标即清除。

### 忘记密码 / 账号被删

- **改密码**：PocketBase 后台 → `aether_editors` → 打开记录 → 改 password（或点邮件重置）。
- **账号被删了**：后台手动新建，或把 `.env` 填好重跑 `pnpm setup`。
- **完全登不进去**：确认 `VITE_PB_URL` 指向的实例上确实存在 `aether_editors` 集合与账号；
  控制台会给出具体原因（密码错误 / 集合不存在 / 连不上实例）。

## 站点品牌自定义

左上角的标题与图标不再是写死的 JSX，而是存在 `aether_settings` 集合里的数据：

- 登录后进入管理态 → 页头「站点设置」→ 改标题 / 上传图标 → 保存；
- 图标走 PocketBase `file` 字段（不是 base64），前端拿的是 40KB 以内的 `128x128` 缩略图；
- **没有上传图标时显示内置三角标记**，不会出现破图；
- 「恢复默认」= 标题清空回 `Aether` + 删除图标；
- 浏览器标签页标题（`document.title`）跟着自定义标题走。

该集合按约定**只有一条记录**，`loadBrand()` 用 `getFirstListItem('')` 读取；记录缺失或集合不存在时
直接回退默认值而**不抛错**，避免「删了一条记录整站白屏」。

## 拖拽排序

管理态下每张卡片左侧有一个拖拽手柄（`⋮⋮`）：

- 桌面鼠标、移动端触摸、键盘（空格拾起 → 方向键 → 空格放下）都支持；
- **支持跨分类拖动**：把网址从「开发常用」拖到「AI」，落点即新分类；
- 只在手柄上按下才触发拖拽 —— 挂在整张卡片上会吃掉移动端的页面滚动，也会让编辑/删除按钮点不动
  （`PointerSensor` 的 `activationConstraint.distance = 6` 是同一目的）；
- 拖拽是乐观更新：松手立刻生效，同时后台 PATCH。**失败会自动回滚到原顺序并提示**，不会静默丢数据；
- 只提交真正变化的记录（`category` 或 `sort_order` 变了的那些），并串行发送，避免并发打爆实例。

浏览态（未点「管理」）下卡片是普通链接，不能拖动。

> 排序依赖 `sort_order`。若同一分类里多条记录 `sort_order` 相同（例如都是默认 `0`），
> 显示顺序由次级的 `created` 决定，而 `created` 相同的记录顺序是**不确定**的。
> 拖动任意一次之后该分类会被重编为 `1..n`，顺序即固定下来。

## 本地缓存与离线

整站数据（品牌 + 分类 + 链接 + 图标 URL）会写入 `localStorage`，key 为 `aether.cache.v1`：

- **二次打开先渲染缓存**，再去拉远程，因此不会出现 loading 骨架闪烁；
- 远程拉取成功即**覆盖**缓存（不做 TTL，始终以远程为准）；
- PocketBase 不可达但本地有缓存 → 照常展示内容，顶部出现一条
  「正在展示本地缓存 · 重新连接后自动更新」的提示（带「重试」）；
- 首次访问（无缓存）行为不变：loading → 内容 / 错误页。

**离线能力的边界（重要）**：缓存的是**数据**，不是图片二进制。离线时图标若不在浏览器 HTTP 缓存里，
会回退成首字母方块，**分类、网址、布局仍然完整可见**。要做到连图标都离线可见需要 Service Worker，
本项目有意不做。

`localStorage` 不可用（Safari 隐私模式、被禁用、配额满）时，应用自动降级为**纯在线模式**，不报错、不白屏。
为此 `src/lib/authStore.ts` 替换了 PocketBase 自带的 `LocalAuthStore` —— 后者在
`_storageGet` 里把 `localStorage.getItem()` 写在 try 之外，且 `send()` 每次请求都要读 token，
一旦 storage 抛异常会导致**所有** API 调用失败。

## 图标

图标按协议走**两条互相独立的路线**，不要混用：

| 书签协议 | 路线 | 做法 | 状态 |
| --- | --- | --- | --- |
| `https://` | `service`（原方案） | 第三方图标服务（`unavatar.io` → `icon.horse`），它们按域名查询、带 CORS | 一直可用，未改动 |
| `http://` | `direct`（新方案） | 抓站点自己的 `/favicon.*`；**不抓字节**，让 `<img>` 直接加载（`<img>` 不受 CORS 限制） | 本次新增 |

判定函数只有一处：`src/lib/icon.ts` 的 `iconRouteFor()`；脚本 `scripts/fetch-icons.mjs` 的
`routeFor()` 与之保持一致。运行 `pnpm icons` 时每行会标注 `[service]` / `[direct]`，可以直观看到走了哪条。

**为什么 http 不能走原方案**：第三方服务只按 **hostname** 查询，端口会被丢掉；
`http://1.2.3.4:8095` 会被它们当成 `http://1.2.3.4/`（80 端口，完全是另一个服务），
内网 IP 它们更是根本访问不到。

**推荐用脚本批量抓**：

### 脚本抓取（Node，无 CORS 限制）

```bash
pnpm icons            # 只处理还没有图标的书签
pnpm icons --force    # 全部重抓并覆盖
pnpm icons --dry      # 只报告会抓什么，不上传
```

为什么必须是脚本：浏览器里 `fetch()` 读跨域图标要求对方服务器发
`Access-Control-Allow-Origin`，自建 nginx/IIS（`http://内网IP:端口` 这类书签）根本不会发；
而且站点一旦部署在 HTTPS，浏览器还会拦截 `http://` 图片（混合内容）。
**Node 两个限制都没有**，所以在这里抓、存成 PocketBase 文件，之后所有客户端都能正常显示
（包括部署在 Vercel 的 HTTPS 站点）。

每个书签的查找顺序：

1. 解析页面 HTML 里的 `<link rel="icon">`（按 `sizes` 取最大）—— 能找到放在
   `/assets/favicon-xxxx.png` 这类非标准路径的图标
2. 探 `/favicon.ico` → `/favicon.png` → `/apple-touch-icon.png`
3. 域名（非 IP）再试第三方服务（`unavatar.io` → `icon.horse`）——
   专治「站点只发 SVG」：PocketBase 的 file 字段**故意不收 `image/svg+xml`**（SVG 能带脚本），
   第三方服务会返回 PNG/JPEG

校验：魔数（PNG/JPEG/WEBP/ICO/GIF）+ 最小 200 字节 + 最大 2MB，HTML 错误页不会被当成图标存进去。

新增书签后重跑 `pnpm icons` 即可补齐。

### 浏览器端兜底

没有存文件的 `http://` 书签，卡片会直接让 `<img>` 去试站点自己的
`/favicon.ico` → `/favicon.png` → `/apple-touch-icon.png` → `/favicon.svg`
（`<img>` 不受 CORS 限制）。这条路只在**站点自身通过 HTTP 访问**时有效，
线上 HTTPS 会被混合内容拦掉 —— 所以别依赖它，用脚本。

### 手动上传

剩下的兜底：编辑书签 → 上传图标（PNG / JPEG / WEBP / ICO / GIF，≤ 2 MB）。
有些系统（例如只返回 HTML 软 404 的 IIS 应用）压根没有 favicon，只能手传。

## 本地开发端口

`pnpm dev` 固定使用 **5199**（`vite.config.ts` 里 `server.port` + `strictPort`）。
不用默认的 5173，是因为这台机器上 5173 被另一个项目占用，两个 dev server 抢同一个地址会互相顶掉。
`strictPort: true` 的作用是端口被占时**直接报错**，而不是悄悄顺延到 5200 让人找不到。

> 这个端口只影响**本地 dev server**。云平台部署（Vercel 等）不读取它 ——
> 构建产物 `dist/` 由平台以静态文件形式在 443 上提供，部署端口与本地无关。

## 移动端

- ≥1100px：每分类 4 列；900–1100px：3 列；640–900px：2 列；<640px：1 列
- 手机上隐藏分类胶囊导航与搜索引擎快捷 chip（搜索框内的下拉仍可切换），减少顶部干扰
- 输入框字号 ≥16px，避免 iOS 聚焦时页面缩放
- 弹窗在窄屏自适应（最大 460px，左右各 24px 安全边距）

## 目录结构

```
scripts/setup-pocketbase.mjs   建表 / 规则 / 账号 / 种子（幂等）
scripts/fetch-icons.mjs        批量抓取图标（Node，无 CORS 限制）
src/
  api/pocketbase.ts            PocketBase 单例 + 领域函数 + PB→LinkItem 映射（唯一适配层）
  components/
    Header.tsx                 悬浮胶囊顶栏（品牌 / 分类筛选 / 管理态 / 登出 / 主题）
    SearchBar.tsx              搜索引擎切换 + 站内实时过滤 + 快捷键
    CategorySection.tsx        Bento 托盘与卡片网格（droppable + SortableContext）
    LinkCard.tsx               网址卡片（图标 / 首字母降级 / 管理态操作）
    SortableLinkCard.tsx       拖拽包装层（dnd-kit useSortable + 手柄）
    BrandModal.tsx             站点设置（标题 / 图标 / 恢复默认）
    ModalForm.tsx              网址与分类弹窗（含「获取图标」与本地预览）
    LoginDialog.tsx            编辑者登录
  lib/cache.ts                 本地快照读写（版本号 + 容错）
  lib/storage.ts               localStorage 安全封装（永不抛错）
  lib/authStore.ts             替换 SDK 的 LocalAuthStore（storage 抛错时仍可用）
  lib/reorder.ts               拖拽纯逻辑（跨分类移动 / sort_order 归一化 / 最小 diff）
  lib/useDialogBehavior.ts     弹窗共用行为（Esc 关闭 + 锁滚动）
  lib/icon.ts                  图标抓取（CORS 源 + 魔数校验 + 缓存）
  lib/format.ts                格式化与显示兜底
  lib/engines.ts               搜索引擎定义
  types/nav.ts                 组件契约（唯一 wire 类型来源）
  App.tsx                      状态编排
  index.css                    设计系统（浅色 / 深色 / 响应式）
```
