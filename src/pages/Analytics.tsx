import TokenHistory from '../components/TokenHistory';
import TokenEfficiency from '../components/TokenEfficiency';
import CostEstimate from '../components/CostEstimate';

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
    </div>
  );
}

export default Analytics;
