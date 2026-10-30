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
| 包管理 | pnpm 11（`packageManager` 已固定版本）|

## 快速开始

```bash
pnpm install

# 1) 配置连接信息
cp .env.example .env
#    编辑 .env：填 VITE_PB_URL / PB_ADMIN_* / PB_EDITOR_*

# 2) 在 PocketBase 上建表（幂等，可重复执行）
pnpm setup

# 3) 启动前端
pnpm dev          # http://localhost:5173
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
3. `upsert` 三个集合与访问规则（保留系统字段，不会误删 `created`/`updated`）；
4. 创建管理态账号（已存在则跳过）；
5. `categories` 为空时写入 3 分类 / 12 站点种子数据。

幂等：重复执行只同步结构，不会重复建账号或写种子数据。

### 集合与权限

| 集合 | 类型 | 说明 |
| --- | --- | --- |
| `aether_editors` | **auth** | 管理态登录账号（PocketBase 原生认证表）；`createRule: null` 禁止匿名注册 |
| `aether_categories` | base | `name`、`sort_order` |
| `aether_links` | base | `category`(relation→categories, cascadeDelete)、`title`、`url`、`description`、`icon`(file)、`sort_order` |

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

### 前端流程

点「管理」→ 未登录则弹登录框 → 登录成功进入管理态 → 可增删改分类与站点。
登录态存于 `localStorage`（`pocketbase_auth`），刷新后保持；点登出图标即清除。

### 忘记密码 / 账号被删

- **改密码**：PocketBase 后台 → `aether_editors` → 打开记录 → 改 password（或点邮件重置）。
- **账号被删了**：后台手动新建，或把 `.env` 填好重跑 `pnpm setup`。
- **完全登不进去**：确认 `VITE_PB_URL` 指向的实例上确实存在 `aether_editors` 集合与账号；
  控制台会给出具体原因（密码错误 / 集合不存在 / 连不上实例）。

## 图标

卡片图标优先用 PocketBase `icon` 文件字段（`pb.files.getURL`，64×64 缩略图）。没有上传图标的
记录回退到 `icon.horse` 显示源，加载失败再降级为站点首字母徽标——任何情况下都不会出现裂图。

弹窗里的「获取图标」在浏览器端完成：

```
1) https://unavatar.io/{host}?fallback=false   ← CORS *，缺失时 404
2) https://icon.horse/icon/{host}              ← CORS *，缺失时给占位图
校验：HTTP 200 && bytes > 200 && 魔数 ∈ {PNG, JPEG, WEBP, ICO, GIF}
```

抓到后本地预览（`blob:`），**保存时才以 `FormData` 上传为 PocketBase 文件**。

### 无法自动获取的情况（以及为什么）

| 情况 | 为什么失败 |
| --- | --- |
| `http://1.2.3.4:8095`（IP / 带端口） | 图标服务只按**主机名**查询，端口被丢弃 → 它们去查 80 端口，那是另一个服务；裸 IP 本身也没有注册图标 |
| 站点只用 `/favicon.png` 或 `/apple-touch-icon.png` | 我们的兜底只探 `/favicon.ico`；且该站点若不发 CORS 头，浏览器读不到字节 |
| 自托管站点不发 CORS | 浏览器同源策略，`fetch` 拿不到响应体，**无法上传** |
| 内网 / localhost 地址 | 第三方服务在外网，访问不到你的内网 |

**兜底方案：弹窗里的「上传图标」。** 选一张本地图片（PNG / JPEG / WEBP / ICO / GIF，≤ 2 MB），
和自动抓取一样会本地预览、保存时上传为 PocketBase 文件。任何站点都能这样配上图标。

其它限制：`google.com/s2/favicons`、`icons.duckduckgo.com`、`favicon.im` 不带 CORS，
只能用于 `<img src>` 显示，不能抓取后上传；纯前端无法读取目标网页 HTML，所以**不会自动填站点标题**。

同一会话内同一 URL 组合只拉取一次（内存缓存）；编辑已有图标的记录且未重新获取/上传时，不会重复上传。

## 移动端

- ≥1100px：每分类 4 列；900–1100px：3 列；640–900px：2 列；<640px：1 列
- 手机上隐藏分类胶囊导航与搜索引擎快捷 chip（搜索框内的下拉仍可切换），减少顶部干扰
- 输入框字号 ≥16px，避免 iOS 聚焦时页面缩放
- 弹窗在窄屏自适应（最大 460px，左右各 24px 安全边距）

## 目录结构

```
scripts/setup-pocketbase.mjs   建表 / 规则 / 账号 / 种子（幂等）
src/
  api/pocketbase.ts            PocketBase 单例 + 领域函数 + PB→LinkItem 映射（唯一适配层）
  components/
    Header.tsx                 悬浮胶囊顶栏（品牌 / 分类筛选 / 管理态 / 登出 / 主题）
    SearchBar.tsx              搜索引擎切换 + 站内实时过滤 + 快捷键
    CategorySection.tsx        Bento 托盘与卡片网格
    LinkCard.tsx               网址卡片（图标 / 首字母降级 / 管理态操作）
    ModalForm.tsx              网址与分类弹窗（含「获取图标」与本地预览）
    LoginDialog.tsx            编辑者登录
  lib/icon.ts                  图标抓取（CORS 源 + 魔数校验 + 缓存）
  lib/format.ts                格式化与显示兜底
  lib/engines.ts               搜索引擎定义
  types/nav.ts                 组件契约（唯一 wire 类型来源）
  App.tsx                      状态编排
  index.css                    设计系统（浅色 / 深色 / 响应式）
```
