'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface StockChartProps {
  data: Array<{ date: string; close: number }>;
  previousClose?: number;
  range?: string;
}

// Custom Tooltip Component
function CustomTooltip({ active, payload, range }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }
  
  const point = payload[0];
  if (!point || !point.payload) {
    return null;
  }
  
  const dateStr = point.payload.date;
  const price = point.payload.close;
  
  // Parse the date string
  const date = new Date(dateStr);
  
  // Validate date
  if (isNaN(date.getTime())) {
    return null;
  }
  
  // Format date based on range - always show full context
  let formattedDate = '';
  let formattedTime = '';
  
  if (range === '1D') {
    // Intraday: Show full date + time with seconds
    formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    formattedTime = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  } else if (range === '5D') {
    // 5 days: Show day + date + time
    formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    formattedTime = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } else {
    // Longer ranges: Just show full date
    formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">
        {formattedDate}
        {formattedTime && <span className="block mt-0.5">{formattedTime}</span>}
      </p>
      <p className="text-sm font-semibold text-foreground">${price?.toFixed(2)}</p>
    </div>
  );
}

export function StockChart({ data, previousClose, range = '1Y' }: StockChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center bg-muted/30 rounded-lg border border-border">
        <p className="text-muted-foreground">No chart data available</p>
      </div>
    );
  }

  // Determine if stock is up or down
  const firstPrice = data[0]?.close || 0;
  const lastPrice = data[data.length - 1]?.close || 0;
  const isUp = lastPrice >= firstPrice;

  // Color scheme
  const strokeColor = isUp ? '#10b981' : '#ef4444'; // Green or Red
  const fillColorStart = isUp ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  const fillColorEnd = isUp ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';

  // Calculate optimal tick count based on data length and range
  const getTickCount = () => {
    const dataLength = data.length;
    if (range === '1D') return Math.min(8, dataLength); // Show ~8 time points for intraday
    if (range === '5D') return Math.min(10, dataLength); // Show ~10 points across 5 days
    if (range === '1M') return Math.min(8, dataLength); // Show ~8 weekly intervals
    if (range === '6M') return Math.min(6, dataLength); // Show monthly intervals
    if (range === '1Y') return Math.min(12, dataLength); // Show each month
    if (range === '5Y') return Math.min(10, dataLength); // Show semi-annual intervals
    return Math.min(8, dataLength); // Default for YTD
  };

  // Get evenly spaced tick indices
  const getTickIndices = () => {
    const tickCount = getTickCount();
    const dataLength = data.length;
    
    if (dataLength <= tickCount) {
      return Array.from({ length: dataLength }, (_, i) => i);
    }
    
    const indices = [];
    const step = (dataLength - 1) / (tickCount - 1);
    
    for (let i = 0; i < tickCount; i++) {
      indices.push(Math.round(i * step));
    }
    
    return indices;
  };

  const tickIndices = getTickIndices();

  // Dynamic X-axis formatter based on range
  const formatXAxis = (dateString: string) => {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    if (range === '1D') {
      // Show time for intraday (e.g., "10:30 AM")
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (range === '5D') {
      // Show day + time for 5D to avoid duplicates (e.g., "Mon 2PM")
      const day = date.toLocaleDateString('en-US', { weekday: 'short' });
      const time = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      return `${day} ${time}`;
    } else if (range === '1M') {
      // Show date (e.g., "Nov 22")
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (range === '6M') {
      // Show month (e.g., "Nov")
      return date.toLocaleDateString('en-US', { month: 'short' });
    } else {
      // For 1Y, 5Y, YTD - show month/year (e.g., "Jan '24")
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  return (
    <div className="h-[180px] md:h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 15, left: 5, bottom: 12 }}
        >
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            stroke="#374151"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            axisLine={{ stroke: '#1f2937' }}
            tickLine={false}
            ticks={tickIndices.map(i => data[i].date)}
            angle={0}
            textAnchor="middle"
            height={30}
          />
          
          <YAxis
            orientation="right"
            domain={['auto', 'auto']}
            stroke="#374151"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            axisLine={{ stroke: '#1f2937' }}
            tickLine={false}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
            width={45}
          />
          
          <Tooltip 
            content={<CustomTooltip range={range} />}
            isAnimationActive={false}
            animationDuration={0}
          />
          
          <Area
            type="monotone"
            dataKey="close"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#colorPrice)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
