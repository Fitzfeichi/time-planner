interface ReviewPanelProps {
  value: string;
  onChange: (value: string) => void;
}

export function ReviewPanel({ value, onChange }: ReviewPanelProps) {
  return (
    <section className="panel-block review-block">
      <div className="panel-title">
        <p>今日复盘</p>
        <strong>记录这一天的收获和偏差</strong>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="例如：上午效率较高，下午被临时事项打断。下一次把深度工作放到 9 点到 11 点。"
        rows={7}
      />
    </section>
  );
}
