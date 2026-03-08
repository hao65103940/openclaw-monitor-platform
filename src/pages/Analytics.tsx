import TokenHistory from '../components/TokenHistory';
import TokenEfficiency from '../components/TokenEfficiency';
import CostEstimate from '../components/CostEstimate';
import SessionLifecycle from '../components/SessionLifecycle';
import SessionTypes from '../components/SessionTypes';
import FailureAnalysis from '../components/FailureAnalysis';
import ModelStats from '../components/ModelStats';
import PerformanceBottleneck from '../components/PerformanceBottleneck';
import ToolUsage from '../components/ToolUsage';
import ChannelDetail from '../components/ChannelDetail';
import SubAgentStats from '../components/SubAgentStats';

function Analytics() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">📈 性能分析</h2>
      
      {/* 阶段 1：Token 深度分析 */}
      <TokenHistory />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TokenEfficiency />
        <CostEstimate />
      </div>

      {/* 阶段 2：会话行为分析 */}
      <SessionLifecycle />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SessionTypes />
        <FailureAnalysis />
      </div>

      {/* 阶段 3：模型与性能分析 */}
      <ModelStats />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceBottleneck />
        <ToolUsage />
      </div>

      {/* 阶段 4：渠道与子 Agent 分析 */}
      <ChannelDetail />
      
      <SubAgentStats />
    </div>
  );
}

export default Analytics;
