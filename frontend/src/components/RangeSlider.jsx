import React, { useState, useEffect } from "react";
import "./RangeSlider.css";

export default function RangeSlider({
  min = 0,
  max = 100,
  step = 1,
  value = [min, max],
  onChange,
  className = "",
  minDistancePercent = 0, // new
}) {
  const [minVal, setMinVal] = useState(value[0]);
  const [maxVal, setMaxVal] = useState(value[1]);

  // keep local state in sync if parent value changes
  useEffect(() => {
    setMinVal(value[0]);
    setMaxVal(value[1]);
  }, [value]);

  const dist = (max - min) * minDistancePercent;
  const clampMin = (v) => Math.min(v, maxVal - step, maxVal - dist);
  const clampMax = (v) => Math.max(v, minVal + step, minVal + dist);

  const handleMin = (e) => {
    let v = clampMin(Number(e.target.value));
    v = Math.round(v * 100) / 100; // two‐decimal precision
    setMinVal(v);
    onChange?.([v, maxVal]);
  };
  const handleMax = (e) => {
    let v = clampMax(Number(e.target.value));
    v = Math.round(v * 100) / 100;
    setMaxVal(v);
    onChange?.([minVal, v]);
  };

  const percent = (v) => ((v - min) / (max - min)) * 100;

  const leftPct = percent(minVal);
  const widthPct = percent(maxVal) - leftPct;
  return (
    <div
      className={`range-slider ${className}`}
      style={{
        "--range-left": `${leftPct}%`,
        "--range-width": `${widthPct}%`,
      }}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={minVal}
        onChange={handleMin}
        className="thumb thumb-min"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={maxVal}
        onChange={handleMax}
        className="thumb thumb-max"
      />
      <div className="track" />
      <div className="range" />
    </div>
  );
}
