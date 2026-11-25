---
name: classnest
description: 班級經營常駐網站的設計系統：教室布告欄
colors:
  felt: "#1f4e5f"
  felt-deep: "#173e4b"
  felt-muted: "#c9dde3"
  sheet: "#fffdf7"
  card: "#ffffff"
  ink: "#1d2a30"
  muted: "#56666c"
  line: "#e6e0d2"
  line-strong: "#c9c1ae"
  focus: "#e9a816"
  danger: "#b3261e"
  danger-soft: "#fdeceb"
  paper-red: "#c23a24"
  paper-sky: "#2a6fae"
  paper-sun: "#f0b323"
  paper-grass: "#2e7634"
  paper-grape: "#7a56b0"
  paper-orange: "#e0761e"
  paper-peach: "#ab3c6f"
  paper-teal: "#167570"
typography:
  display:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.7rem, 4.6vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.02em"
  numeral:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "clamp(2.6rem, 5vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "clamp(1.4rem, 3vw, 1.8rem)"
    fontWeight: 400
    lineHeight: 1.3
  title:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "1.12rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  subhead:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.3
  dialog-title:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.3
  small:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
  tag:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 700
    lineHeight: 1.4
  label:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.4
  student-body:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 400
    lineHeight: 1.7
  student-tag:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
  pin:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 400
    lineHeight: 1.2
    fontFeature: "tnum"
  stage-label:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "clamp(1.25rem, min(4.6cqw, 6cqh), 4.5rem)"
    fontWeight: 400
    lineHeight: 1.2
  stage-time:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "min(13cqw, 28cqh)"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  stage-tag:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "clamp(1rem, min(2.6cqw, 4cqh), 2rem)"
    fontWeight: 700
    lineHeight: 1.4
  code:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  pin: "50%"
  tiny: "3px"
  card-top: "4px"
  tag: "6px"
  label: "10px"
  control: "12px"
  sheet: "14px"
  dialog: "18px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.felt}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "8px 18px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 18px"
    height: "44px"
  group-label-selected:
    backgroundColor: "{colors.paper-red}"
    textColor: "{colors.card}"
    rounded: "10px"
    padding: "6px 16px"
    height: "44px"
  student-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card-top}"
    padding: "26px 16px 14px"
  tab-active:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    height: "46px"
  tab:
    backgroundColor: "{colors.felt-deep}"
    textColor: "{colors.felt-muted}"
    height: "46px"
  board-strip:
    backgroundColor: "color-mix(paper 14%, card)"
    textColor: "{colors.ink}"
    rounded: "{rounded.card-top}"
    padding: "26px 16px 12px"
  stage:
    backgroundColor: "{colors.felt}"
    textColor: "{colors.card}"
    rounded: "{rounded.sheet}"
  dial:
    backgroundColor: "{colors.card}"
    textColor: "{colors.paper-red}"
    rounded: "{rounded.pin}"
  note:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "4px"
    padding: "12px 14px 10px"
---

# Design System: classnest

## Overview

**Creative North Star：教室布告欄。** 外框是深藍綠絨布，內容是一張溫白的圖畫紙；每個孩子是一張釘在布告欄上的白紙卡，每次加分就是一枚圖釘。這是老師上課中單手操作的工作畫面（Operate），世界只提供字體、配色、密度與一個招牌動作，導覽與控制元件一律是標準網頁元件。

不幼稚也不冷冰冰：一到六年級都會看到，所以色紙的飽和度用來分組，而不是拿來裝飾。拒絕的樣子：灰白卡片牆的一般後台、紫色主色的班級點數 App、奶油色紙加襯線字的「文青」模板。

## Colors

色彩策略是 Full palette：絨布與圖畫紙兩個中性面，加上八種色紙顏色，各自有固定工作。

### Primary
- **絨布深藍綠** (#1f4e5f)：外框底色、頂欄、主要按鈕。深色模式改為 #1c4654，仍看得出藍綠色。
- **絨布深處** (#173e4b)：未選取的紙片分頁。

### Secondary：色紙（分組色）
依組別建立順序循環分配，同一組在標籤、學生卡滾邊、之後的課表都用同一色。每色都配一個保證 AA 對比的文字色（`--on-*`）。
- **番茄紅** (#c23a24)、**天空藍** (#2a6fae)、**草綠** (#2e7634)、**葡萄紫** (#7a56b0)、**桃粉** (#ab3c6f)、**湖水青** (#167570)：配白字，對比 5.2 以上。
- **向日葵黃** (#f0b323)、**橘子** (#e0761e)：配深色字（#3a2a00、#2e1700），對比 5.4 以上。黃色也用在可領獎勵的虛線框與焦點框。

### Neutral
- **溫白圖畫紙** (#fffdf7)：內容區與對話框底。
- **白卡** (#ffffff)：學生卡、清單、獎勵卡。
- **墨色** (#1d2a30)／**灰墨** (#56666c)：內文／輔助文字。
- **紙邊線** (#e6e0d2)／**紙邊深線** (#c9c1ae)：分隔線、輸入框框線、沒有組別的卡片滾邊。

### Named Rules
**一組一色規則。** 組別顏色由組別順序決定，全站一致；不要為了好看替同一組換色。
**狀態不靠顏色規則。** 可領獎勵是黃色虛線框；已發放是綠色實線框加勾；撤銷與停用是刪除線。

## Typography

**Display Font：** Huninn（jf open 粉圓，Google Fonts 分片載入），後備為系統黑體。
**Body Font：** 系統黑體（PingFang TC、Noto Sans TC、微軟正黑體）。

### Hierarchy
- **Display**（400，clamp(1.7rem, 4.6vw, 2.6rem)，1.3）：網站標題，只出現在絨布頂欄。
- **Numeral**（400，clamp(2.6rem, 5vw, 3.6rem)，1，等寬數字）：學生卡上的累積分。
- **Headline**（400，clamp(1.4rem, 3vw, 1.8rem)）：各分頁標題。
- **Dialog title**（400，1.5rem）：對話框標題、加分理由的分數。
- **Subhead**（400，1.3rem）：「最近的加分」、設定頁小節、獎勵名稱。
- **Small**（400，0.95rem）：說明段落、小按鈕、分數單位。
- **Tag**（700，0.85rem）：獎勵緞帶。
- **Title**（700，1.12rem）：學生名、清單主文字。
- **Body**（400，17px，1.6）：說明與表單；說明段落最寬 65ch。
- **Label**（600，0.9rem）：時間、老師名、緞帶文字；數字一律等寬。
- **Student body／Student tag**（1.1rem 行高 1.7／1rem 粗）：分享頁給學生看的便條內文與作業徽章。
- **Pin**（粉圓 1.6rem，等寬數字）：分享頁的通關碼輸入。
- **Stage label／Stage time／Stage tag**（粉圓／粉圓等寬數字／黑體粗）：大螢幕舞台上的計時名稱、剩餘時間與「暫停中」。字級用舞台的容器單位（cqw、cqh）算，舞台多大字就多大，投影 1920 寬時剩餘時間約 250px。
- **Code**（等寬，0.9rem）：只用在 agent 金鑰、MCP 網址與設定指令這類要原樣複製的字串，不拿來裝飾。

**粉圓只說大事規則。** 粉圓只用在標題與分數，內文、按鈕、表單一律系統黑體。

## Layout

最寬 76rem 置中，兩側至少 16px（含瀏海安全區）。分頁是一排可在自身內左右滑動的紙片，頁面本身永不左右捲動。學生卡固定欄數：手機 2 欄、700px 起 3 欄（iPad 直向）、1000px 起 5 欄（iPad 橫向與桌機）；同一列卡片等高。內容區內距 clamp(16px, 3vw, 32px)，區塊間距 20px。

## Dark Mode

晚上備課用，世界不變：絨布 #1c4654（仍是藍綠）、紙面是溫暖的深紙色 #2f2a24、卡片 #3b352d、墨色 #f4ede1，紙邊線也跟著偏暖（#4d463c、#8a7f6e，虛線框對紙面 3.6:1）。色紙改成較亮的版本並配深色字（`--on-*`），滾邊與圖釘照樣鮮明；所有文字對比 6.6:1 以上。

## Elevation & Depth

紙張是被釘在絨布上的：卡片有柔和的帶偏移陰影，懸停時微微抬起、略為傾斜；對話框用較深的陰影浮在半透明絨布遮罩上。

### Shadow Vocabulary
- **紙** (`box-shadow: 0 2px 4px rgb(23 62 75 / 0.08), 0 10px 24px rgb(23 62 75 / 0.12)`)：內容區、卡片、清單。
- **抬起** (`box-shadow: 0 4px 8px rgb(23 62 75 / 0.12), 0 18px 36px rgb(23 62 75 / 0.18)`)：懸停中的學生卡、對話框、登入紙。
- **圖釘** (`box-shadow: 1px 3px 2px rgb(0 0 0 / 0.3), 2px 5px 6px rgb(0 0 0 / 0.12)`)：圖釘的針影；落下動畫起點是 `0 14px 10px rgb(0 0 0 / 0.08)`。
- **色票** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.2)`)：組別頁的色紙色票。
- **舞台凹陷** (`box-shadow: inset 0 2px 10px rgb(0 0 0 / 0.18)`)：大螢幕的絨布舞台，像布告欄上凹下去的一塊；全螢幕時拿掉。

## Shapes

紙卡頂端是方角（4px）並帶一條 14px 高的色紙波浪滾邊（遮罩畫出的半圓），底部 14px 圓角；按鈕與輸入框 12px；組別標籤 10px；緞帶、門檻標記與焦點框 6px；組別色票與標籤色塊 3px；對話框 18px。靜止時每三張卡有兩張略斜（-0.5° 與 0.35°），像手釘上去的。

## Components

### Buttons
- **Shape：** 12px 圓角，最小高度 44px。
- **Primary：** 絨布色底、白字；懸停加深。
- **Secondary：** 白底、紙邊深線框。
- **Quiet（撤銷）：** 透明底、淡框；懸停轉為紅色警示。與其他按鈕之間留空（在列尾靠右）。

### Group Labels（組別色紙標籤）
- **未選：** 透明底、2px 該組色紙框，前面一個小色塊。
- **已選：** 整個填滿該組色紙，文字用對應的 `--on-*` 色。

### Student Card（招牌元件）
白卡、頂端色紙波浪滾邊（依所屬組）、名字與右上角最多 3 枚最近的圖釘（顏色依加分理由）、粉圓大數字、可領獎勵的虛線緞帶。選了某組時，其他組的卡改用混色底、虛線框、淡化的滾邊，分數轉灰墨；文字維持 AA 對比，仍留在原處且可點。

### Setup Steps（空布告欄）
組別、加分理由、學生任一項還沒建立時，加分頁顯示三張釘上去的步驟卡（番茄紅、天空藍、向日葵黃滾邊，粉圓大編號），每張是前往該分頁的連結。完成的步驟改成虛線框加刪除線與「已完成」勾；三步都完成後不再出現。編號代表真的先後順序。

### Bulletin Board（公布欄：面板與便條）
每個面板是一欄：頂端一張標題紙（該面板第一個組別的色紙染 14% 到白卡上，帶同一條波浪滾邊；全班面板用向日葵黃），下面直接釘一張張便條，不再用外框把整欄包起來（卡片裡不放卡片）。標題紙寫面板名稱（粉圓）、「分享中」（分享圖示＋草綠字）或「私人」（鎖頭圖示），以及組別或「全班」。欄數：手機 1 欄、700px 起 2 欄、1000px 起 3 欄（iPad 橫向第一屏就看得到三個面板）；便條寬度不到 300px 時，編輯與排序按鈕自動移到便條最底下一列靠右（container query），標題不被擠斷行、也不和內文拆開。
- **便條：** 白卡、4px 小圓角、紙陰影，部分便條 -0.4° 或 0.3° 的手釘斜度。不另標「文字／連結／作業」一行：第一行就是標題（Title 字級），老師的編輯與上下移按鈕在右上角同一列；作業在標題下有番茄紅虛線徽章「作業」或「作業・繳交 12/1（二）」；內容保留換行；連結是一顆「打開連結」按鈕加一顆放大 QR Code 的按鈕，下一行小字是網域。agent 貼的便條最下面一行灰字「由 agent：名稱 貼上」。剛貼上的便條用和圖釘同一條 0.55 秒 ease-out 落下釘住，減少動態效果時直接出現。
- **深色標題紙：** 暗下來的黃與紅必然變成土黃、磚褐，所以深色模式的標題紙用卡片色，色紙只留在頂端滾邊與底部 4px 色帶。
- **空公布欄：** 兩張虛線框的範例標題紙（向日葵黃「本週進度」、番茄紅「回家作業」），點一下就建好一個全班分享的面板。
- **QR Code：** 對話框加寬到 36rem，白底黑格、四格白邊、最寬 22rem，下面是完整網址、「複製網址」與「打開連結」，投影時全班掃得到。
- **分享列：** 分享連結是一條虛線框的工具列（不是釘上去的紙），放「複製連結」「QR Code」「分享設定」；還沒有分享的面板時只留「分享設定」與一句提示，不給會打開空白頁的連結。
- **刪除與換新連結：** 在同一個對話框裡先換成確認文字與紅色「確定刪除／確定換新連結」，不跳第二層視窗。

### Share Page（分享頁 /s/代碼）
給代課老師、學生、家長看，不登入。外框一樣是絨布與標題，紙面上方是組別色紙標籤（「全部」＋有分享面板的組），下面是唯讀的面板與便條（沒有建立者、沒有編輯鈕）；給一到六年級看，所以便條標題 1.3rem、內文 1.1rem、行高 1.7。要通關碼時顯示一張和登入頁同款的紙，上面有網站標題，中間一個粉圓大字、等寬數字的 4 位數輸入框；打錯時紅框紅字並寫出補救方法。

### Agent Keys（設定頁）
金鑰清單沿用老師清單樣式。產生後的對話框只出現一次金鑰：黃色虛線框寫明「只會出現這一次」，金鑰、MCP 網址與 Claude Code 一行設定各自一個等寬字串框加複製按鈕。

### Screen（大螢幕計時）
給投影看的計時畫面，只有時間，不放任何學生資料或分數。左邊（1000px 起，21rem 寬）或上方是設定：「計時」一張紙（常用分鐘按鈕 1、3、5、10、15、20、30，粉圓大數字，一按就開始；下面是自訂分鐘 1 到 180）與「倒數到時刻」一張紙（名稱可不填，例如「下課」；時刻用原生時間欄位；已經過的時刻在欄位下方紅字說明，不開始）。
- **舞台：** 一塊絨布（深淺色模式都是絨布，投影對比最穩），上方粉圓寫「計時 10 分鐘」或「下課 10:30」，中間是釘在絨布上的紙鐘面，旁邊或下方是粉圓大字剩餘時間。舞台用 container query 排版：寬比高大 1.15 倍以上時鐘面與數字左右並排，否則上下疊。
- **鐘面：** 白卡圓面（深淺色模式都是白紙配番茄紅，投影對比固定）、外圈一道紙邊、12 道刻度（SVG 線條，3、6、9、12 點較長）、中心一枚絨布色圖釘。剩餘時間是一塊番茄紅扇形，像時鐘指針一樣往 12 點收（`<progress>` 加 `conic-gradient`，`--value` 用 `@property` 註冊，每 250 毫秒更新一次並平滑過渡；減少動態效果時直接跳）。閒置時扇形是淡灰，不顯示數字。
- **控制列：** 舞台最下面一列，左邊是計時操作（向日葵黃主按鈕「暫停／繼續」、「重來」、「結束」；倒數到時刻只有「結束」），右邊是工具（「靜音」開關、閒置時的「試聽」、「全螢幕」）。舞台上的次要按鈕是透明底白框白字；靜音按下時改成絨布深處底加實線白框、圖示換成斜線鈴鐺，不比主按鈕搶眼。常用分鐘按鈕排成 4 欄。瀏覽器不支援全螢幕（例如 iPhone）時不顯示該按鈕。
- **暫停：** 數字改成淡藍灰，下方一個向日葵黃虛線框「暫停中」。
- **時間到：** 扇形消失、數字換成向日葵黃粉圓大字「時間到」，舞台內側一圈 4px 向日葵黃虛線（不只靠顏色）；字用和圖釘同一條 0.55 秒 ease-out 落下，減少動態效果時直接出現。提示音是現場合成的三個上行音響兩次，靜音記在這台裝置。

### Pin（招牌動作）
加分成功時，新圖釘從上方落下、略過頭再停住（0.55 秒，exponential ease-out）；減少動態效果時直接出現。撤銷後那枚圖釘消失。

### Navigation
紙片分頁：未選是絨布深處色，選中的分頁變成和內容區同色的紙、頂端一條 3px 向日葵黃紙邊，與內容區左上角對齊接在一起（深色模式靠色相與紙邊分辨）。

### Inputs / Fields
溫白底、1.5px 紙邊深線、12px 圓角；焦點是 3px 向日葵黃外框；離開欄位後才顯示錯誤（`:user-invalid`），錯誤是紅框、淡紅底與紅字說明。

## Do's and Don'ts

### Do:
- **Do** 讓每個組在全站都用同一種色紙。
- **Do** 用形狀（虛線、實線加勾、刪除線）表達狀態，顏色只是加強。
- **Do** 讓上課中的操作一兩下完成：卡片本身就是加分按鈕。

### Don't:
- **Don't** 在大螢幕或學生看得到的地方顯示分數排行。
- **Don't** 在一張卡上疊第二條滾邊、貼紙或其他裝飾；卡片裡不再放卡片。
- **Don't** 用文字符號或表情符號當圖示；圖示用 2px 線寬的自繪 SVG。
