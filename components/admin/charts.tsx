/**
 * Tiny SVG charts — no dependency, brand-themed, RTL-aware.
 * Good enough for dashboards. If you want richer interactions later,
 * swap in Recharts.
 */

interface BarSeries { label: string; values: number[]; color: string }

export function StackedBarChart({
  labels,
  series,
  height = 220,
  formatY,
}: {
  labels: string[];
  series: BarSeries[];
  height?: number;
  formatY?: (n: number) => string;
}) {
  const totals = labels.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0));
  const maxY = Math.max(1, ...totals);
  const barWidth = 100 / labels.length;
  const barInner = barWidth * 0.62;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {/* gridlines */}
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line key={p} x1={0} x2={100} y1={height - height * p} y2={height - height * p}
            stroke="#eee" strokeWidth={0.3} />
        ))}
        {labels.map((_, i) => {
          const x = i * barWidth + barWidth / 2 - barInner / 2;
          let yCursor = 0;
          return (
            <g key={i}>
              {series.map((ser) => {
                const v = ser.values[i] ?? 0;
                if (v === 0) return null;
                const h = (v / maxY) * height;
                const rect = (
                  <rect
                    key={ser.label}
                    x={x}
                    y={height - yCursor - h}
                    width={barInner}
                    height={h}
                    fill={ser.color}
                  >
                    <title>{ser.label}: {formatY ? formatY(v) : v}</title>
                  </rect>
                );
                yCursor += h;
                return rect;
              })}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-[#666] px-1">
        {labels.map((l, i) => (
          <span key={i} className="truncate" style={{ width: `${barWidth}%` }}>{l}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-3 justify-center text-xs">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MiniBars({ values, color = '#578e7e' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8">
      {values.map((v, i) => {
        const w = 100 / values.length;
        const h = (v / max) * 30;
        return (
          <rect
            key={i}
            x={i * w + w * 0.15}
            y={30 - h}
            width={w * 0.7}
            height={h}
            fill={color}
            opacity={v > 0 ? 1 : 0.2}
          />
        );
      })}
    </svg>
  );
}

export function HourHeatmap({
  matrix,        // [day 0..6][hour 0..23]
}: {
  matrix: number[][];
}) {
  const max = Math.max(1, ...matrix.flat());
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px]">
        <thead>
          <tr>
            <th className="text-right p-1"></th>
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="p-0.5 text-center font-normal text-[#888]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d, dayIdx) => (
            <tr key={d}>
              <td className="text-right p-1 pr-2 whitespace-nowrap text-[#666]">{d}</td>
              {Array.from({ length: 24 }, (_, h) => {
                const v = matrix[dayIdx]?.[h] ?? 0;
                const intensity = v / max;
                const bg =
                  v === 0
                    ? '#f5f5f7'
                    : `rgba(87, 142, 126, ${0.15 + intensity * 0.85})`;
                return (
                  <td
                    key={h}
                    className="p-0"
                    style={{ background: bg, minWidth: 14, height: 18 }}
                    title={`${d} ${h}:00 — ${v} طلب`}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
