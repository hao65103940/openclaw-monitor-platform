# 登录页面系统设计

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React SPA)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ 登录页面  │  │ 路由守卫  │  │ Auth Hook│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│         │              │              │                      │
│         └──────────────┴──────────────┘                      │
│                        │                                      │
│                  Axios 拦截器                                 │
│                  (自动附加 Token)                             │
└────────────────────────┼─────────────────────────────────────┘
                         │
                    JWT Token
                         │
┌────────────────────────┼─────────────────────────────────────┐
│                        后端 (Express API)                     │
│  ┌─────────────────────┴─────────────────────┐               │
│  │           认证中间件 (JWT Verify)          │               │
│  └─────────────────────┬─────────────────────┘               │
│         │              │              │                       │
│  ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐                │
│  │  登录 API    │ │ 登出 API  │ │ 用户信息 API│                │
│  │ /auth/login │ │/auth/logout│ │ /auth/me  │                │
│  └──────┬──────┘ └────┬─────┘ └─────┬──────┘                │
│         │             │              │                       │
│  ┌──────▼──────────────▼──────────────▼──────┐               │
│  │           认证服务 (AuthService)           │               │
│  │  - 密码验证 (bcrypt)                       │               │
│  │  - Token 生成 (JWT)                         │               │
│  │  - 会话管理                                │               │
│  └──────┬────────────────────────────────────┘               │
│         │                                                     │
│  ┌──────▼────────────────────────────────────┐               │
│  │           数据存储 (SQLite)                │               │
│  │  - users 表（用户信息）                    │               │
│  │  - sessions 表（会话信息）                  │               │
│  └───────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 数据库设计

### 1. users 表

```sql
CREATE TABLE users (
  id            VARCHAR(64) PRIMARY KEY,
  username      VARCHAR(64) UNIQUE NOT NULL,
  password      VARCHAR(255) NOT NULL,      -- bcrypt 哈希
  email         VARCHAR(128),
  role          VARCHAR(16) NOT NULL DEFAULT 'user',  -- admin/user/guest
  avatar        VARCHAR(255),
  is_active     BOOLEAN DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

### 2. sessions 表

```sql
CREATE TABLE sessions (
  id            VARCHAR(64) PRIMARY KEY,
  user_id       VARCHAR(64) NOT NULL REFERENCES users(id),
  token         VARCHAR(512) NOT NULL,      -- JWT Token
  expires_at    TIMESTAMPTZ NOT NULL,
  ip_address    VARCHAR(45),                -- IPv4/IPv6
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### 3. login_logs 表（可选）

```sql
CREATE TABLE login_logs (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(64) NOT NULL,
  success       BOOLEAN NOT NULL,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  reason        VARCHAR(255),               -- 失败原因
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_logs_username ON login_logs(username);
CREATE INDEX idx_login_logs_created ON login_logs(created_at);
```

---

## 🔌 API 设计

### 1. POST /api/auth/login

**请求：**
```json
{
  "username": "admin",
  "password": "password123",
  "rememberMe": true
}
```

**响应（成功）：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-001",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "avatar": null
    },
    "expiresIn": 604800
  }
}
```

**响应（失败）：**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "用户名或密码错误"
  }
}
```

### 2. POST /api/auth/logout

**请求：**
```
POST /api/auth/logout
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "message": "已退出登录"
}
```

### 3. GET /api/auth/me

**请求：**
```
GET /api/auth/me
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "user-001",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "avatar": null,
    "lastLogin": "2026-03-07T19:00:00Z"
  }
}
```

### 4. POST /api/auth/refresh

**请求：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800
  }
}
```

---

## 🎨 前端组件设计

### 1. 页面结构

```
src/
├── pages/
│   ├── Login.tsx              # 登录页面
│   └── Dashboard.tsx          # 仪表盘（需要登录）
├── components/
│   └── LoginForm.tsx          # 登录表单组件
├── hooks/
│   └── useAuth.ts             # 认证 Hook
├── services/
│   └── auth.ts                # 认证 API 服务
├── store/
│   └── useAuthStore.ts        # 认证状态管理
└── guards/
    └── AuthGuard.tsx          # 路由守卫
```

### 2. 登录页面布局

```tsx
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │    🔐 OpenClaw 监控平台          │   │
│  │                                 │   │
│  │    欢迎回来，请登录              │   │
│  │                                 │   │
│  │    ┌───────────────────────┐   │   │
│  │    │ 用户名                │   │   │
│  │    │ [________________]    │   │   │
│  │    │                       │   │   │
│  │    │ 密码                  │   │   │
│  │    │ [________________] 👁️│   │   │
│  │    │                       │   │   │
│  │    │ ☐ 记住我              │   │   │
│  │    │                       │   │   │
│  │    │ [    登  录    ]      │   │   │
│  │    │                       │   │   │
│  │    │ 忘记密码？联系管理员   │   │   │
│  │    └───────────────────────┘   │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 3. 状态管理（useAuthStore）

```typescript
interface AuthState {
  // 数据
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // 状态
  loading: boolean;
  error: string | null;
  
  // 操作
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}
```

---

## 🔐 安全实现

### 1. 密码加密

```typescript
import bcrypt from 'bcryptjs';

// 密码哈希
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// 密码验证
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 2. JWT Token

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 生成 Token
const token = jwt.sign(
  { userId: user.id, username: user.username, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }  // 7 天有效期
);

// 验证 Token
const decoded = jwt.verify(token, JWT_SECRET);
```

### 3. 前端 Token 存储

```typescript
// 方案 1：localStorage（简单，但易受 XSS 攻击）
localStorage.setItem('token', token);

// 方案 2：HttpOnly Cookie（更安全，需要后端配合）
document.cookie = `token=${token}; HttpOnly; Secure; SameSite=Strict; path=/; max-age=604800`;

// 推荐：混合方案
// - accessToken 存 localStorage（7 天）
// - refreshToken 存 HttpOnly Cookie
```

### 4. Axios 拦截器

```typescript
// 请求拦截器：自动附加 Token
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 Token 过期
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token 过期，跳转登录
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 📁 文件清单

### 后端文件

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `server-auth.js` | 认证 API 服务 | P0 |
| `middleware/auth.js` | JWT 验证中间件 | P0 |
| `services/authService.js` | 认证业务逻辑 | P0 |
| `db/schema.sql` | 数据库表结构 | P0 |
| `db/init.js` | 数据库初始化脚本 | P0 |

### 前端文件

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `src/pages/Login.tsx` | 登录页面 | P0 |
| `src/components/LoginForm.tsx` | 登录表单 | P0 |
| `src/hooks/useAuth.ts` | 认证 Hook | P0 |
| `src/services/auth.ts` | 认证 API 服务 | P0 |
| `src/store/useAuthStore.ts` | 认证状态管理 | P0 |
| `src/guards/AuthGuard.tsx` | 路由守卫 | P0 |

---

## 🚀 实施步骤

### 阶段一：基础框架（2 小时）

1. 创建数据库表
2. 实现登录 API
3. 创建登录页面
4. 实现路由守卫

### 阶段二：状态管理（1 小时）

1. 实现 useAuthStore
2. 实现 useAuth Hook
3. 集成 Axios 拦截器

### 阶段三：测试优化（1 小时）

1. 功能测试
2. 安全测试
3. 性能优化
4. 错误处理

---

## ✅ 验收标准

### 功能验收

- [ ] 可以成功登录
- [ ] 可以成功登出
- [ ] 未登录访问受保护页面跳转登录
- [ ] Token 过期自动跳转登录
- [ ] 记住我功能正常

### 安全验收

- [ ] 密码加密存储
- [ ] Token 验证正常
- [ ] SQL 注入防护
- [ ] XSS 防护
- [ ] CSRF 防护

### 性能验收

- [ ] 登录响应 < 500ms
- [ ] 页面加载 < 2 秒
- [ ] 并发登录支持

---

**设计完成。** 准备开始实现。
