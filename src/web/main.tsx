import { render } from "preact";
import { App } from "./App";
import { installFieldValidation } from "./forms";
import { PrintCards } from "./PrintCards";
import { PublicPage } from "./PublicPage";
import { StudentPage } from "./StudentPage";
import "./styles.css";

installFieldValidation();
// /s/<分享代碼> 是給代課老師、學生、家長看的分享頁；/student 是學生平板；/cards 是老師印圖卡密碼；其他路徑是老師後台
const path = location.pathname.replace(/\/$/, "");
const share = path.match(/^\/s\/([A-Za-z0-9_-]+)$/);
const page = share ? <PublicPage code={share[1]} /> : path === "/student" ? <StudentPage /> : path === "/cards" ? <PrintCards /> : <App />;
render(page, document.getElementById("app")!);
