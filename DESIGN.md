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
  student-heading:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "clamp(1.6rem, 4.4vw, 2.2rem)"
    fontWeight: 400
    lineHeight: 1.25
  student-numeral:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "clamp(3.6rem, 12vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  avatar:
    fontFamily: "Huninn, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1
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
- **Student heading／Student numeral／Avatar**（粉圓 clamp(1.6rem, 4.4vw, 2.2rem)／粉圓等寬 clamp(3.6rem, 12vw, 5.5rem)／粉圓 2rem，大頭像 2.7rem）：學生平板的步驟標題、學生頁自己的累積分、頭像上的字。
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
給代課老師、學生、家長看，不登入。外框一樣是絨布與標題，紙面上方是組別色紙標籤（「全部」＋有分享面板的組），下面先是「聯絡簿」（有已發送的才出現：最近 5 個日期，一天一段，上方一條紙邊虛線、黑體粗字「週三 12/2」，今天多一個黃虛線「今天」小標；下面每組一張和老師端同款的紙，組名是 Title 字級，只有作業、要帶、備註，內文 1.1rem、行高 1.7），再來是唯讀的面板與便條（有聯絡簿時前面加一個同層級的粉圓段落標題「公布欄」，面板標題降一層；「聯絡簿」「公布欄」段落標題比面板標題大）（沒有建立者、沒有編輯鈕）；給一到六年級看，所以便條標題 1.3rem、內文 1.1rem、行高 1.7。要通關碼時顯示一張和登入頁同款的紙，上面有網站標題，中間一個粉圓大字、等寬數字的 4 位數輸入框；打錯時紅框紅字並寫出補救方法。

### Agent Keys（設定頁）
金鑰清單沿用老師清單樣式。產生後的對話框只出現一次金鑰：黃色虛線框寫明「只會出現這一次」，金鑰、MCP 網址與 Claude Code 一行設定各自一個等寬字串框加複製按鈕。

### Screen（大螢幕計時）
給投影看的計時畫面，只有時間，不放任何學生資料或分數。左邊（1000px 起，21rem 寬）或上方是設定：「計時」一張紙（常用分鐘按鈕 1、3、5、10、15、20、30，粉圓大數字，一按就開始；下面是自訂分鐘 1 到 180）與「倒數到時刻」一張紙（名稱可不填，例如「下課」；時刻用原生時間欄位；已經過的時刻在欄位下方紅字說明，不開始）。
- **舞台：** 一塊絨布（深淺色模式都是絨布，投影對比最穩），上方粉圓寫「計時 10 分鐘」或「下課 10:30」，中間是釘在絨布上的紙鐘面，旁邊或下方是粉圓大字剩餘時間。舞台用 container query 排版：寬比高大 1.15 倍以上時鐘面與數字左右並排，否則上下疊。
- **鐘面：** 白卡圓面（深淺色模式都是白紙配番茄紅，投影對比固定）、外圈一道紙邊、12 道刻度（SVG 線條，3、6、9、12 點較長）、中心一枚絨布色圖釘。剩餘時間是一塊番茄紅扇形，像時鐘指針一樣往 12 點收（`<progress>` 加 `conic-gradient`，`--value` 用 `@property` 註冊，每 250 毫秒更新一次並平滑過渡；減少動態效果時直接跳）。閒置時扇形是淡灰，不顯示數字。
- **控制列：** 舞台最下面一列，左邊是計時操作（向日葵黃主按鈕「暫停／繼續」、「重來」、「結束」；倒數到時刻只有「結束」），右邊是工具（「靜音」開關、閒置時的「試聽」、「全螢幕」）。舞台上的次要按鈕是透明底白框白字；靜音按下時改成絨布深處底加實線白框、圖示換成斜線鈴鐺，不比主按鈕搶眼。常用分鐘按鈕排成 4 欄。瀏覽器不支援全螢幕（例如 iPhone）時不顯示該按鈕。
- **暫停：** 數字改成淡藍灰，下方一個向日葵黃虛線框「暫停中」。
- **依課表：** 設定區最上面多一張「依課表」紙，按「依課表自動倒數」後，舞台依節次與這週的課自己切換：上課中寫「第二節　上課中」並倒數到下課；下課與第一節前寫「下課　第二節 09:30 上課」並倒數到上課（第一節前的扇形只看最後 15 分鐘）。數字下方是課：組別色小方塊（永遠是那一組的色紙，停課也一樣；沒有組別就不畫）＋粉圓「數學 B 組・數學」（下課時前面一個小字「下一節」，同一行、最小 0.875rem，不做眉標）；只排了組別沒寫科目就只寫組別，兩者都沒有就寫「空堂」，標題也改寫「空堂」而不是「上課」。換節時課程那一塊用圖釘同一條 0.55 秒曲線落下，減少動態效果時直接出現，再下面一塊向日葵黃底的「要帶：量角器、直尺」。扇形改用那一組的色紙（一組一色），沒有組別或停課時用番茄紅。停課是實心番茄紅「停課・原因」，不提醒帶東西。放學後、週末寫明原因並說「上課日會依課表自動倒數，這一頁開著就好」；沒有節次時是一顆向日葵黃「到課表設定節次」。依課表模式鐘面略小（讓出課程那兩行）。進入與離開上課時響同一個提示音，第一次打開不響；停課的節上下課不響（相接的兩節只要有一節照常上課就響）。啟用中設定區那張紙保留說明，按鈕原位換成同高度、前面一枚向日葵黃圖釘的狀態文字（「正在依課表倒數」；還沒有節次時是「等你設定好節次就開始」），版面不位移，免得下一下點到「計時」。說明句用子句為單位斷行，不把詞拆開。
- **簽到：** 設定區第二張「簽到」紙：沒開放時一行說明加主按鈕「開放簽到 10 分鐘」；開放中原位換成向日葵黃圖釘的狀態文字「簽到開放到 08:52」與「提早結束」。下面「已簽到 N 人」（關掉後寫「上一次（08:40 開放）簽到 N 人」，12 小時內），老師清單樣式的小列（名字、時間、淡色「撤銷」）。舞台在開放中多一條：黃虛線小標「簽到中・到 08:52」加「已簽到 N 人」，下面是白紙小名牌（粗體顯示名、一枚番茄紅圖釘、手釘斜度），新簽到的用圖釘落下動畫；只列已簽到的，不列誰還沒來，名牌的圖釘釘在上緣正中；超過 12 人時名牌字級縮小，全部列出、不裁掉。沒有人時一行灰字教學生怎麼簽（按鈕名照學生頁寫「我來了，簽到」）。計時或依課表倒數中鐘面與數字縮小讓出位置；沒在計時、只開放簽到時，標題改成「簽到」、拿掉空鐘面，名牌放大成舞台主角。設定區的已簽到清單是不套框的單行小列（名字、時間、撤銷同一行）。
- **時間到：** 扇形消失、數字換成向日葵黃粉圓大字「時間到」，舞台內側一圈 4px 向日葵黃虛線（不只靠顏色）；字用和圖釘同一條 0.55 秒 ease-out 落下，減少動態效果時直接出現。提示音是現場合成的三個上行音響兩次，靜音記在這台裝置。

### Schedule（課表）
「課表」分頁頂端右邊是三顆並排的紙片切換鈕（12px 圓角，radio 語意、圓點藏起來，選中的整顆填絨布色）：每週計畫、固定課表、節次時間。還沒有節次時，前兩個畫面改成一個虛線空框，按鈕直接帶到「節次時間」。
- **課表格：** 寬度 44rem 以上是一張語意表格（`<table>`，欄是週一到週五、列是節次，列頭寫節次名稱與時間），用 container query 判斷；窄的時候改成一排同款紙片星期鈕（預設今天）加上那天各節的清單。今天那一欄標頭底線換向日葵黃、加一個黃虛線「今天」小標；淺色模式格子底色淡淡染黃，深色模式改成稍微提亮的卡片色（暗下來的黃會變土黃）。每週計畫裡，今天正在上的那一節：列頭（窄版是那一節的標題列）多一顆實心向日葵黃「上課中」小標，那一格卡片外加 3px 向日葵黃實線框；每 30 秒重算，下課時間不標。
- **一節課（lesson）：** 小紙卡，頂端 10px 的組別色紙波浪滾邊（和學生卡同一種，縮小版），科目（粗）、組別（灰，和科目同名時不重複）、教學內容（最多三行）、「作業」番茄紅虛線徽章加作業內容（最多兩行）、「帶：…」。格線裡的卡不做手釘斜度，讓同一列對齊、好掃讀。按鈕的名稱就是卡上的文字，前面用視覺隱藏文字補上「週一第一節：」、後面補「（編輯）」。
- **空堂：** 很淡的紙邊色虛線框，中間一個灰墨色小加號（對紙面 3:1 以上，看得出可以點）；「空堂」兩字只給報讀軟體。
- **狀態形狀各不相同（不只靠顏色）：** 停課是實心番茄紅小標「停課・原因」，卡片淡化、科目與組別刪除線，而且不顯示內容、作業、要帶的東西（免得學生替停掉的課準備）；換課是墨色實線框小標加交換圖示「換課」；作業是番茄紅虛線；今天是向日葵黃虛線；上課中是實心向日葵黃小標加黃色實線框。
- **懸停：** 只有能懸停的裝置會加深陰影；位移只在沒開「減少動態效果」時發生，iPad 點過不會卡在浮起狀態。
- **編輯一節：** 對話框（加寬）上方一行灰字寫固定課表原本的安排，接著是教學內容、作業、這週要帶的東西（提示文字寫出預設），下面一段虛線分隔的「只有這一週」：勾「換課」出現組別與科目、勾「停課」出現原因。內容長時「儲存」固定在對話框底部（紙面色底、上方一條紙邊線）。儲存後那一格用便條同款 0.55 秒釘上動畫落下一次（清掉一格不播），減少動態效果時不播。
- **每週計畫的工具列：** 「上一週／週一–週五日期／下一週」三格一列，右邊「回到本週」（不在本週時才出現）與「複製上週」，複製結果寫在旁邊的 `role="status"`。週末打開時直接顯示下一週。
- **節次時間：** 一張新增表單（名稱預設下一個「第幾節」、上課、下課用原生時間欄位），下面是老師清單樣式的節次列表，每列一顆「修改」；刪除在同一個對話框裡先換成確認文字。

### Diary（聯絡簿）
一天一組一則，給老師寫、給家長看。
- **工具列：** 「前一天／星期與日期（今天加黃虛線「今天」小標）／後一天」三格一列，跳過週末；不在預設那天時右邊多一顆「回到今天」。週末打開直接顯示下週一。按鈕字不換行。
- **一組一張紙：** 和公布欄標題紙同一種 14px 組別色紙波浪滾邊，白卡、紙陰影；標題是組名（粉圓 Subhead），下面是「作業」（番茄紅虛線徽章）、「要帶」、「備註」三行，標籤欄 3.4em、內容保留換行。手機一欄、700px 兩欄、1100px 三欄，卡片高度照內容，不拉齊。
- **狀態形狀各不相同（不只靠顏色）：** 還沒寫是沒有釘上去的虛線框紙（透明底、滾邊照樣全色；淺色虛線用紙邊深線混灰墨，對紙面 3:1 以上，深色用紙邊深線），裡面是灰墨「課表上今天（或週三）這一組有：」加帶入的建議，或只寫「還沒寫」，按鈕是主按鈕「寫聯絡簿」；草稿是墨色虛線框小標「草稿」，agent 草擬時下面一行灰字「金鑰名稱 草擬」，旁邊直接一顆主按鈕「發送」；已發送是實心草綠小標加勾「已發送 07:54」，旁邊是「複製文字」。
- **編輯對話框（加寬）：** 標題「組名・週三 12/2」；還沒寫時先帶入課表的作業與要帶的東西，最上面一行灰字說明；已經寫過、而課表內容不同時，最上面一行灰字加一顆次要按鈕「重新從課表帶入」。作業與備註的輸入框跟著內容長高（`field-sizing: content`，3 到 12 行）。下面一段虛線分隔的「個別加註」：灰字說明只有老師看得到，每位學生一列（名字、輸入框、已發送且有加註時一顆只有圖示的複製鈕），用 subgrid 讓輸入框一樣寬，手機上名字在輸入框上方。底部固定列：左邊「存草稿」（已發送時是淡色「收回成草稿」）、右邊主按鈕「發送」（已發送時是「更新」）；空的時候發送鈕停用，旁邊灰字寫原因。
- **複製文字：** 「【11/25 國語 A 組】」一行，接「作業：」「要帶：」「備註：」各一行，空的不寫；複製給個別學生時最後多一行「王〇明：加註」。

### Student Tablet（學生平板 /student）
給一到六年級在平板上自己登入，一步只做一件事，字大、按鈕大（44px 以上，主要目標 96px 高）。外框和分享頁一樣是絨布頂欄（網站標題，右邊是「學生平板」或「我的平板」），紙面最寬 62rem。
- **選組：** 標題粉圓「你是哪一組？」，下面每組一張整張填滿該組色紙的紙（粉圓組名、紙陰影、手釘斜度），只有一組時直接跳過這一步。
- **選人：** 「點你的名字」，右邊「換一組」；組名是一個填滿色紙的小標。學生是白卡（紙陰影），上面一個圓頭像（名字第一個字、粉圓，放在第一個所屬組別的色紙上，帶圖釘的針影），下面粗體名字。還沒有圖卡密碼的學生是沒有釘上去的虛線紙、虛線圓頭像，並寫「還沒有圖卡，請找老師」，按不下去（不只靠淡化）。寵物上線後頭像換成寵物。
- **圖卡：** 頂端是頭像＋粉圓名字，右邊「不是我」；「依序點你的 3 張圖卡」，下面三個 68px 的位置（虛線框裡是粉圓灰墨 1、2、3，點了就換成那張圖），再下面是 3×3 的圖卡（最寬 36rem）。圖卡深淺色模式都是白紙、紙邊線、紙陰影，圖是幾何形狀拼成的 SVG（太陽、月亮、星星、愛心、花、樹、魚、蘋果、房子；形狀和顏色都不一樣，墨色 2.5px 外框），下面粗體名字；點過的那張變虛線框、圖淡掉。點滿 3 張自動送出；錯了三個位置左右晃一下（減少動態效果時不晃）、清空，紅字寫出原因（`role="status"`）；暫停時整組圖卡停用。
- **學生頁：** 第一張是學生自己的「學生卡」（和加分頁的學生卡同一種：白卡、頂端組別色紙波浪滾邊），頭像加粉圓「嗨，王〇明」、粉圓特大等寬數字的累積分（clamp(3.6rem, 12vw, 5.5rem)，只有自己看得到）、「再 13 分：獎勵名稱」與一條向日葵黃的 `<progress>`（18px、全圓角）。下面「我的獎勵」：可以領的是黃虛線緞帶「可以找老師領：…」，已拿到是草綠實線加勾「已經拿到：…」。再下面「聯絡簿」：所屬每組最近一次已發送的一則，和聯絡簿同款的紙（組名、星期日期、作業／要帶／備註，1.1rem 行高 1.7），老師給這位學生的加註放在黃虛線框「老師給你的話」。頂欄右邊是白框按鈕「換人」（共用）或「登出」（個人）；共用平板最下面一行灰字說明，90 秒沒動自動換人。
- **簽到：** 老師開放簽到時，學生頁最上面一顆 80px 高、絨布色、粉圓大字的「我來了，簽到」；簽好是草綠實線框加勾「簽到好了！」，共用平板接一句「5 秒後換下一位。」並自動換人。學生頁開著時每 15 秒更新，老師一開放按鈕就出現。
- **不是學生平板：** 和登入頁同款的紙，「這台還不是學生平板」，說明老師要到哪裡設定，一顆「老師登入」。

### Picture Cards（圖卡密碼：老師端）
- **設定 › 學生平板：** 小節標題右邊一顆「把這台設成學生平板」；清單沿用老師清單樣式（名字、「共用平板／個人平板・記住 王〇明・最後使用 11/27 10:20」、一顆「管理」）。設定對話框：名字、兩個大選項（共用、個人，各一行說明）、黃虛線框提醒「這台會登出老師帳號並打開學生登入頁」。管理對話框：改名，「登出這台」在同一個對話框裡先換成確認文字與紅色「確定登出這台」。
- **學生 › 圖卡密碼：** 每位使用中的學生一顆「圖卡密碼」，還沒有的在灰字寫「還沒有圖卡密碼」。對話框裡是三張依序的圖卡（固定三欄，每張左上角一枚絨布色圓形圖釘寫 1、2、3）；「重新產生」在同一個對話框裡先換成說明與紅色「確定重新產生」。
- **印圖卡密碼（/cards）：** 老師登入才看得到。一位學生一張紙條（虛線是剪裁線、頂端 6px 組別色、名字與組別、三張依序的圖卡），列印時隱藏「列印」按鈕。

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
