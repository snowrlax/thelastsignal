import { ImageResponse } from "next/og";
import { glyphFor } from "@/components/crt/font5x7";

export const alt = "THE LAST SIGNAL: a short interactive psychological horror experience";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DOT = 11;
const GAP = 3;

function DotLine({ text, color }: { readonly text: string; readonly color: string }) {
  const chars = [...text];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
      {Array.from({ length: 7 }, (_, row) => (
        <div key={row} style={{ display: "flex", gap: GAP }}>
          {chars.flatMap((char, index) => {
            const glyph = glyphFor(char);
            const cells = glyph[row].map((lit, column) => (
              <div key={`${index}-${column}`} style={{ width: DOT, height: DOT, background: lit ? color : "transparent" }} />
            ));
            return index < chars.length - 1 ? [...cells, <div key={`${index}-gap`} style={{ width: DOT, height: DOT }} />] : cells;
          })}
        </div>
      ))}
    </div>
  );
}

/** Share card in the style of the title screen: an orange handset LCD with a dot-matrix title. */
export default function OpenGraphImage() {
  const ink = "#2b1200";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050302",
        }}
      >
        <div
          style={{
            width: 1110,
            height: 560,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "36px 48px",
            borderRadius: 48,
            background: "radial-gradient(ellipse at 50% 46%, #ffad2b 0%, #ff8f0d 55%, #e46d00 100%)",
            boxShadow: "0 0 80px rgba(255, 140, 20, 0.35)",
          }}
        >
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", color: ink, fontSize: 34, fontWeight: 700 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
              {[10, 16, 22, 28].map((height, index) => (
                <div key={height} style={{ width: 8, height, background: ink, opacity: index < 2 ? 1 : 0.25 }} />
              ))}
              <div style={{ display: "flex", marginLeft: 18, width: 40, height: 28, border: `5px solid ${ink}` }} />
            </div>
            <span>23:58</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
            <DotLine text="THE LAST" color="#ffd84a" />
            <DotLine text="SIGNAL." color="#ffd84a" />
          </div>
          <div style={{ display: "flex", color: ink, fontSize: 30, letterSpacing: 2 }}>NOVEMBER 2. IT WAS NEVER MEANT TO SPEAK BACK.</div>
        </div>
      </div>
    ),
    size,
  );
}
