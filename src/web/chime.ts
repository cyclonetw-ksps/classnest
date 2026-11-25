// 時間到的提示音：用 Web Audio 現場合成三個上行音（不用音檔，不必另外下載）。
// iPad 與手機的瀏覽器只在使用者按下按鈕時才准開聲音，所以「開始」與「試聽」時先 unlockChime()。

let ctx: AudioContext | null = null;

export function unlockChime() {
  try {
    ctx ??= new AudioContext();
    // Safari 鎖屏或切 App 回來可能是 "interrupted"，不是 running 就重新啟動
    if (ctx.state !== "running") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function playChime() {
  unlockChime();
  if (!ctx) return;
  const start = ctx.currentTime + 0.05;
  // C5、E5、G5，再響一次，教室後面也聽得到但不刺耳
  const notes = [523.25, 659.25, 783.99, 523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const t = start + i * 0.32 + (i >= 3 ? 0.5 : 0);
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  });
}

const MUTE_KEY = "classnest:screen-muted";

type MuteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function deviceStorage(): MuteStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

// 靜音記在這台裝置；瀏覽器擋住儲存空間時當作沒靜音
export function readMuted(storage: MuteStorage | undefined = deviceStorage()): boolean {
  try {
    return storage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean, storage: MuteStorage | undefined = deviceStorage()) {
  try {
    if (muted) storage?.setItem(MUTE_KEY, "1");
    else storage?.removeItem(MUTE_KEY);
  } catch {
    // 存不了就只在這次有效
  }
}
