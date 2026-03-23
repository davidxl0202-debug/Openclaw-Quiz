# OpenClaw Quiz - 在线多人实时答题系统

一个基于 React + Firebase 的在线多人实时答题系统，支持管理员和参与者两种角色，15 道 OpenClaw 知识竞赛题目。

## 功能特性

- **双角色系统**：管理员创建房间、控制答题流程；参与者加入房间、实时答题
- **实时同步**：基于 Firebase Realtime Database，所有操作实时同步
- **30 秒倒计时**：每题限时 30 秒，SVG 动画倒计时环
- **智能计分**：答对 +10 分，答对且速度最快的前 10 名额外加分（第 1 名 +10，第 2 名 +9...第 10 名 +1）
- **实时排行榜**：管理员可随时查看排行榜，答题结束后显示领奖台
- **深色科技主题**：暗色背景 + 霓虹渐变配色，玻璃拟态卡片
- **响应式设计**：适配桌面和移动端

## 快速开始

### 1. 创建 Firebase 项目

1. 前往 [Firebase Console](https://console.firebase.google.com)
2. 点击"创建项目"，按提示完成
3. 在左侧菜单选择 **Build → Realtime Database**
4. 点击"创建数据库"，选择区域，选择"以测试模式启动"
5. 复制数据库 URL（形如 `https://your-project-default-rtdb.firebaseio.com`）

### 2. 设置数据库规则

在 Firebase Console → Realtime Database → 规则，粘贴以下内容：

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    },
    "players": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    },
    "answers": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### 3. 本地运行

```bash
# 克隆项目
git clone https://github.com/你的用户名/openclaw-quiz.git
cd openclaw-quiz

# 安装依赖
npm install

# 方式一：使用环境变量（推荐）
cp .env.example .env
# 编辑 .env 文件，填入你的 Firebase 配置

# 方式二：在页面中输入
# 直接运行，首次打开会显示配置页面

# 启动开发服务器
npm run dev
```

### 4. 部署到 GitHub Pages

```bash
# 方式一：使用 gh-pages 包
npm run build
npm run deploy

# 方式二：手动部署
# 1. 将 dist 目录推送到 gh-pages 分支
# 2. 在 GitHub 仓库 Settings → Pages 中选择 gh-pages 分支
```

**使用 GitHub Actions 自动部署：**

在仓库中创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_DATABASE_URL: ${{ secrets.FIREBASE_DATABASE_URL }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}

      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

然后在 GitHub 仓库 Settings → Secrets 中添加对应的 Firebase 配置。

## 使用说明

### 管理员

1. 打开应用，点击"管理员"
2. 点击"创建房间"，获得 6 位房间码
3. 将房间码分享给参与者
4. 等待参与者加入后，点击"开始答题"
5. 每题 30 秒倒计时结束后（或全员答完），点击"显示结果"
6. 查看答题统计和速度加分后，点击"下一题"

### 参与者

1. 打开应用，点击"参与者"
2. 输入房间码和昵称，加入房间
3. 等待管理员开始答题
4. 每题在 30 秒内选择答案
5. 查看答题结果和分数
6. 最终查看排行榜

## 技术栈

- **前端**：React 18 + React Router 6
- **构建工具**：Vite 5
- **实时数据库**：Firebase Realtime Database
- **部署**：GitHub Pages
- **样式**：纯 CSS（深色科技主题）

## 项目结构

```
src/
├── main.jsx              # 应用入口
├── App.jsx               # 主应用（路由 + Firebase 配置）
├── App.css               # 全局样式
├── firebase.js           # Firebase 初始化
├── questions.js          # 题目数据
├── pages/
│   ├── Home.jsx          # 首页（选择角色）
│   ├── AdminPage.jsx     # 管理员页面
│   └── PlayerPage.jsx    # 参与者页面
└── components/
    ├── Timer.jsx          # 倒计时组件
    └── Leaderboard.jsx    # 排行榜组件
```
