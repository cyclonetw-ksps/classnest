import { useEffect, useRef, useState } from "preact/hooks";
import { loginWithGoogle } from "./api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsi(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load"));
    document.head.appendChild(s);
  });
}

export function Login(props: { title: string; clientId: string; onLoggedIn: () => void }) {
  const button = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!props.clientId) {
      setMessage("這個網站還沒設定 Google 登入（GOOGLE_CLIENT_ID），請部署的老師照安裝說明設定。");
      return;
    }
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !button.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: props.clientId,
          callback: async ({ credential }) => {
            setMessage("登入中…");
            try {
              await loginWithGoogle(credential);
              props.onLoggedIn();
            } catch (err) {
              setMessage((err as Error).message);
            }
          },
        });
        window.google.accounts.id.renderButton(button.current, { theme: "outline", size: "large", text: "signin_with", locale: "zh-TW" });
      })
      .catch(() => setMessage("載入 Google 登入失敗，請檢查網路後重新整理。"));
    return () => {
      cancelled = true;
    };
  }, [props.clientId]);

  return (
    <main class="login">
      <h1>{props.title}</h1>
      <p class="muted">老師請用學校的 Google 帳號登入。</p>
      <div ref={button} class="gsi" />
      <p role="status" class="login-msg">
        {message}
      </p>
    </main>
  );
}
