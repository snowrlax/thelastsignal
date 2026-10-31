/** Shared SVG definitions: the convex "pillow" outline of an old CRT tube. */
export default function CrtDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <clipPath id="crt-pillow" clipPathUnits="objectBoundingBox">
          <path d="M0.055,0.014 Q0.5,-0.006 0.945,0.014 Q0.99,0.018 0.993,0.07 Q1.006,0.5 0.993,0.93 Q0.99,0.982 0.945,0.986 Q0.5,1.006 0.055,0.986 Q0.01,0.982 0.007,0.93 Q-0.006,0.5 0.007,0.07 Q0.01,0.018 0.055,0.014 Z" />
        </clipPath>
        <clipPath id="crt-pillow-wide" clipPathUnits="objectBoundingBox">
          <path d="M0.022,0.012 Q0.5,-0.004 0.978,0.012 Q0.996,0.016 0.997,0.05 Q1.003,0.5 0.997,0.95 Q0.996,0.984 0.978,0.988 Q0.5,1.004 0.022,0.988 Q0.004,0.984 0.003,0.95 Q-0.003,0.5 0.003,0.05 Q0.004,0.016 0.022,0.012 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
