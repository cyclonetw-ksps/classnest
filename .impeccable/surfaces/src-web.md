---
version: 1
slug: "src-web"
primary_target: "src/web"
related_targets: []
---

# Surface brief：老師後台（加分、學生、組別、加分理由、獎勵、設定）

Scope：src/web 的老師後台，之後的學生頁與大螢幕沿用同一個世界。Mode：Operate。

Audience／job：資源班老師上課中單手用 iPad 一兩下替學生或整組加分、撤銷；課前整理名單、組別、理由、獎勵。

Constraints：一到六年級都會看到這個網站，不能幼稚；分數不排名；標準網頁控制元件；iPad 與手機寬度無左右捲動；AA 對比；尊重減少動態效果。

## Direction contract

THESIS：教室後方的布告欄。每個孩子是一張釘在絨布上的白紙卡，每次加分就是一枚圖釘；拒絕一般後台的灰白卡片牆與紫色點數 App。

OWN-WORLD：深藍綠絨布（細點紋）做外框與頂欄；內容區是溫白圖畫紙；每個組固定擁有一種色紙顏色（番茄紅、向日葵黃、天空藍、草綠、葡萄紫…依建立順序），用在組別標籤、學生卡頂端的一條波浪滾邊、之後的課表。標題與大數字用 jf open 粉圓（Huninn），內文用系統黑體。狀態不靠顏色：可領獎勵是虛線框、已發放實線加勾、撤銷是刪除線。

STORY：老師一眼看到這組每個孩子的累積分與最近的圖釘，點卡片、點理由，圖釘釘上去、數字跳一格；按錯就在最近紀錄撤銷，圖釘拔掉。

FIRST VIEWPORT：絨布頂欄左邊大字網站標題、右邊老師名與登出；下面一排紙片分頁（目前頁是白紙接上內容區）；內容區頂端是組別色紙標籤，選了某組時有「替整組加分」；學生卡格線（iPad 直向 3 欄、橫向 5 欄、手機 2 欄），卡片頂端滾邊、名字、粉圓大數字、右上最多 3 枚最近圖釘、可領獎勵虛線緞帶；其他組的卡變淡不消失；最下面是最近加分紀錄，撤銷按鈕與加分按鈕間留空。

FORM：教室布告欄，自己清單的第 4 名（清單依序：聯絡簿、集點印章卡、綠豆觀察日記、教室布告欄、作息時間表、貼紙收集簿、田字格作業簿）。seed:18c30ea0835f8607

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
