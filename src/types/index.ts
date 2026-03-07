// Agent 相关类型
export interface Agent {
  id: string;
  agentId: string;
  status: 'running' | 'done' | 'failed' | 'pending';
  task: string;
  label: string;
  runtime: string;
  runtimeMs: number;
  model: string;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  startedAt: number;
  endedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Session 相关类型
export interface Session {
  sessionKey: string;
  kind: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: {
    role: string;
    content: string;
    createdAt: number;
  };
}

// 统计数据类型
export interface Stats {
  totalAgents: number;
  activeAgents: number;
  completedAgents: number;
  failedAgents: number;
  totalTokens: number;
  totalRuntime: number;
  avgRuntime: number;
  modelUsage: Record<string, number>;
}

// 链路追踪类型
export interface TraceNode {
  id: string;
  label: string;
  status: 'running' | 'done' | 'failed';
  runtime: number;
  tokens?: {
    input: number;
    output: number;
  };
  children?: TraceNode[];
}

export interface TraceEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  timestamp?: number;
}

// API 响应类型
export interface SubagentsListResponse {
  status: string;
  total: number;
  active: Agent[];
  recent: Agent[];
  text: string;
}

export interface SessionsListResponse {
  sessions: Session[];
  total: number;
}
