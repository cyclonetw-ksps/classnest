import { render } from "preact";
import { App } from "./App";
import { installFieldValidation } from "./forms";
import { PublicPage } from "./PublicPage";
import "./styles.css";

installFieldValidation();
// /s/<分享代碼> 是給代課老師、學生、家長看的分享頁；其他路徑是老師後台
const share = location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)\/?$/);
render(share ? <PublicPage code={share[1]} /> : <App />, document.getElementById("app")!);
