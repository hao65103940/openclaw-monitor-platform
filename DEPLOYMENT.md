# Monitor Platform 部署指南

OpenClaw Agent 监控系统部署文档。

---

## 📋 目录

1. [系统要求](#系统要求)
2. [推荐部署位置](#推荐部署位置)
3. [快速部署](#快速部署)
4. [配置说明](#配置说明)
5. [生产环境部署](#生产环境部署)
6. [故障排查](#故障排查)

---

## 系统要求

### 硬件要求
- **CPU**: 1 核以上
- **内存**: 512MB 以上（推荐 1GB）
- **磁盘**: 100MB 可用空间
- **网络**: 需要访问 OpenClaw CLI

### 软件要求
- **Node.js**: v18.0 或更高版本
- **npm**: v8.0 或更高版本
- **OpenClaw**: 已安装并配置完成

---

## 推荐部署位置

### 方案 1：作为 OpenClaw 子项目（推荐）⭐

将监控平台部署在 OpenClaw 安装目录下，便于管理和访问。

```
/root/.openclaw/
└── monitor-platform/      # 监控平台
    ├── server.js
    ├── src/
    ├── config.json
    └── .env
```

**优点：**
- ✅ 路径配置简单（相对路径）
- ✅ 便于访问 OpenClaw 数据
- ✅ 统一管理，备份方便
- ✅ 符合 OpenClaw 生态系统

**部署命令：**
```bash
cd /root/.openclaw
git clone https://github.com/your-repo/monitor-platform.git
cd monitor-platform
npm install
```

---

### 方案 2：独立部署

部署在独立目录，适合多 OpenClaw 实例监控。

```
/opt/monitor-platform/     # 监控平台
├── server.js
├── src/
├── config.json
└── .env
```

**优点：**
- ✅ 与 OpenClaw 解耦
- ✅ 可监控多个 OpenClaw 实例
- ✅ 独立升级维护

**缺点：**
- ⚠️ 需要配置绝对路径
- ⚠️ 权限管理复杂

---

### 方案 3：Docker 容器化部署（高级）

使用 Docker 容器部署，适合生产环境。

```bash
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -v /root/.openclaw:/root/.openclaw \
  monitor-platform:latest
```

**优点：**
- ✅ 环境隔离
- ✅ 易于扩展
- ✅ 版本控制简单

**缺点：**
- ⚠️ 需要 Docker 环境
- ⚠️ 配置相对复杂

---

## 快速部署

### 步骤 1：克隆项目

```bash
# 进入 OpenClaw 目录
cd /root/.openclaw

# 克隆监控平台（或复制现有项目）
git clone https://github.com/your-repo/monitor-platform.git
cd monitor-platform
```

### 步骤 2：安装依赖

```bash
npm install
```

### 步骤 3：配置文件

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件（根据实际情况修改）
nano .env
```

**关键配置项：**
```bash
# OpenClaw 路径（如果使用默认安装位置，无需修改）
OPENCLAW_BASE_PATH=/root/.openclaw
OPENCLAW_AGENTS_PATH=/root/.openclaw/agents
OPENCLAW_WORKSPACE_PATH=/root/.openclaw/workspace

# 端口配置
PORT=3001
```

### 步骤 4：启动服务

```bash
# 使用启动脚本（推荐）
./start.sh

# 或手动启动
# 后端
node server.js &

# 前端（开发模式）
npm run dev
```

### 步骤 5：访问

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:3001/api/health

---

## 配置说明

### config.json - 基础配置

```json
{
  "openclaw": {
    "cliPath": "/root/.nvm/versions/node/v24.13.0/bin/openclaw",
    "nodePath": "/root/.nvm/versions/node/v24.13.0/bin/node",
    "basePath": "/root/.openclaw",
    "agentsPath": "/root/.openclaw/agents",
    "workspacePath": "/root/.openclaw/workspace"
  },
  "server": {
    "port": 3001,
    "host": "0.0.0.0",
    "cacheTTL": 5000,
    "logPath": "/root/.openclaw/monitor-platform/logs"
  },
  "security": {
    "allowedBasePaths": ["/root/.openclaw"]
  }
}
```

### .env - 环境变量

```bash
# 前端配置
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false

# 后端配置
PORT=3001
HOST=0.0.0.0
OPENCLAW_CLI_PATH=/root/.nvm/versions/node/v24.13.0/bin/openclaw
OPENCLAW_BASE_PATH=/root/.openclaw

# 缓存配置
CACHE_TTL=5000

# 安全配置
ALLOWED_BASE_PATHS=/root/.openclaw
```

---

## 生产环境部署

### 1. 构建生产版本

```bash
# 构建前端
npm run build

# 输出到 dist/ 目录
```

### 2. 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动后端服务
pm2 start server.js --name monitor-api

# 启动前端（使用 nginx 反向代理更佳）
pm2 start npm --name monitor-web -- run dev

# 查看状态
pm2 status

# 保存配置（开机自启）
pm2 save
pm2 startup
```

### 3. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name monitor.your-domain.com;

    # 前端静态文件
    location / {
        root /root/.openclaw/monitor-platform/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. 配置 HTTPS（可选）

```bash
# 使用 Let's Encrypt
sudo certbot --nginx -d monitor.your-domain.com
```

### 5. 防火墙配置

```bash
# 开放端口（如果使用默认端口）
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp

# 或只开放 nginx 端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 多实例监控配置

如果需要监控多个 OpenClaw 实例，修改 `config.json`：

```json
{
  "openclaw": {
    "instances": [
      {
        "name": "production",
        "basePath": "/root/.openclaw"
      },
      {
        "name": "staging",
        "basePath": "/home/user/.openclaw-staging"
      }
    ]
  }
}
```

---

## 故障排查

### 后端服务无法启动

```bash
# 检查端口占用
lsof -i:3001

# 查看日志
tail -f logs/server.log

# 检查 Node.js 版本
node --version

# 检查依赖
npm install
```

### 前端无法连接 API

```bash
# 测试 API
curl http://localhost:3001/api/health

# 检查防火墙
sudo ufw status

# 检查 .env 配置
cat .env | grep API_BASE_URL
```

### OpenClaw CLI 命令失败

```bash
# 检查 CLI 路径
which openclaw

# 测试 CLI
openclaw --version

# 检查权限
ls -la /root/.nvm/versions/node/v24.13.0/bin/openclaw
```

### 日志文件权限问题

```bash
# 检查日志目录权限
ls -la logs/

# 修复权限
chmod 755 logs/
chown -R $USER:$USER logs/
```

---

## 升级指南

### 从 Git 更新

```bash
cd /root/.openclaw/monitor-platform

# 拉取最新代码
git pull

# 安装新依赖
npm install

# 重启服务
./stop.sh
./start.sh
```

### 备份配置

```bash
# 备份配置文件
cp .env .env.backup
cp config.json config.json.backup

# 升级后恢复配置
cp .env.backup .env
cp config.json.backup config.json
```

---

## 卸载

```bash
# 停止服务
./stop.sh

# 删除进程（如果使用 PM2）
pm2 delete monitor-api
pm2 delete monitor-web

# 删除项目
cd /root/.openclaw
rm -rf monitor-platform

# 清理 PM2 日志
pm2 flush
```

---

## 技术支持

- **文档**: `/root/.openclaw/monitor-platform/README.md`
- **日志**: `tail -f logs/server.log`
- **API 测试**: `curl http://localhost:3001/api/health`

---

**祝你部署顺利！** 🎉
