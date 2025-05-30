import React, { useState, useEffect } from "react";
import "./RangeSlider.css";

export default function RangeSlider({
  min = 0,
  max = 100,
  step = 1,
  value = [min, max],
  onChange,
  className = "",
}) {
  const [minVal, setMinVal] = useState(value[0]);
  const [maxVal, setMaxVal] = useState(value[1]);

  // keep local state in sync if parent value changes
  useEffect(() => {
    setMinVal(value[0]);
    setMaxVal(value[1]);
  }, [value]);

  const clampMin = v => Math.min(v, maxVal - step);
  const clampMax = v => Math.max(v, minVal + step);

  const handleMin = e => {
    const v = clampMin(Number(e.target.value));
    setMinVal(v);
    onChange && onChange([v, maxVal]);
  };
  const handleMax = e => {
    const v = clampMax(Number(e.target.value));
    setMaxVal(v);
    onChange && onChange([minVal, v]);
  };

  const percent = v => ((v - min) / (max - min)) * 100;

  return (
    <div className={`range-slider ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={minVal}
        onChange={handleMin}
        className="thumb thumb--min"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={maxVal}
        onChange={handleMax}
        className="thumb thumb--max"
      />
      <div className="track" />
      <div
        className="range"
        style={{
          left: `${percent(minVal)}%`,
          width: `${percent(maxVal) - percent(minVal)}%`,
        }}
      />
    </div>
  );
}
