import qrcode from "qrcode-generator";
import { useMemo } from "preact/hooks";

// 自己畫 QR Code 的 SVG（不塞 innerHTML）：每個黑格一段 path，四周留 4 格白邊方便手機掃
export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    let path = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + 4},${r + 4}h1v1h-1z`;
    return { size: n + 8, d: path };
  }, [text]);
  return (
    <svg class="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shape-rendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
