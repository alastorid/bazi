// 資料庫只保存教材有明確解釋的星曜。出現於命盤不等於有可用星義。
// direct：材料直接解釋單星；group：材料明確解釋所屬星組；
// combination：只能在材料明確給出的宮位／組合規則中使用，禁止推導通用屬性。
const definition = (name, category, explanationLevel, meaning, usageLimit = "") => ({
  name, category, explanationLevel, meaning, usageLimit,
});

export const STAR_DEFINITIONS = Object.freeze([
  definition("紫微", "主星", "direct", "帝星、文武官帶、貴人、正財、解厄制化；喜左輔右弼"),
  definition("天機", "主星", "direct", "文官帶、正財；公務員、教師、銀行等"),
  definition("太陽", "主星", "direct", "武官帶、貴人、解厄、財祿；父親、丈夫、兒子"),
  definition("武曲", "主星", "direct", "武官帶、財星王、貴人、解厄"),
  definition("天同", "主星", "direct", "人和、解厄"),
  definition("廉貞", "主星", "direct", "次桃花、武官帶"),
  definition("天府", "主星", "direct", "南斗星君、溫和、文官／教師；本身不能解厄"),
  definition("太陰", "主星", "direct", "文官帶、正財；女子坐命漂亮"),
  definition("天梁", "主星", "direct", "食神、文武官帶"),
  definition("天相", "主星", "direct", "佐才星、秘書／助理／參謀、厚道溫和"),
  definition("七殺", "主星", "direct", "武官星；性急、多疑、剛烈"),
  definition("破軍", "主星", "direct", "武官星；孤僻、體瘦、不重利、勞耗"),
  definition("貪狼", "主星", "direct", "武官星、桃花、財；酒色財氣賭"),
  definition("巨門", "主星", "direct", "口舌、是非、官司、牢獄；廟旺口才好，也主豪門宅第"),
  definition("祿存", "財祿", "direct", "財星，同化祿；守財；與天馬構成祿馬交馳"),
  definition("天刑", "凶性輔曜", "direct", "是非、官司、刑尅"),

  definition("左輔", "六吉", "group", "六吉；輔助紫微"),
  definition("右弼", "六吉", "group", "六吉；輔助紫微"),
  definition("天魁", "六吉", "group", "六吉、科甲"),
  definition("天鉞", "六吉", "group", "六吉、科甲"),
  definition("文昌", "六吉", "group", "六吉、科甲、讀書考試"),
  definition("文曲", "六吉", "group", "六吉、才藝、博學、多能、斯文"),
  definition("三台", "解厄輔曜", "group", "輔助天府；與八座同論"),
  definition("八座", "解厄輔曜", "group", "輔助天府；與三台同論"),
  definition("天巫", "解厄輔曜", "group", "神煞吉星；解厄、化煞輔助"),
  definition("解神", "解厄輔曜", "group", "神煞吉星；解厄、化煞輔助"),
  definition("紅鸞", "桃花婚姻", "group", "桃花、婚姻"),
  definition("天喜", "桃花婚姻", "group", "桃花、婚姻"),
  definition("擎羊", "六煞", "group", "與陀羅同論小人、疾病、血光"),
  definition("陀羅", "六煞", "group", "與擎羊同論小人、疾病、血光"),
  definition("火星", "六煞", "group", "與鈴星同論火厄、衝突、口角"),
  definition("鈴星", "六煞", "group", "與火星同論火厄、衝突、口角"),
  definition("天空", "六煞", "group", "與地劫同論耗損；做生意流年逢之賠"),
  definition("地劫", "六煞", "group", "與天空同論耗損"),

  definition("天馬", "驛動", "combination", "驛動、移動、奔波、外地", "只用於教材反覆明確的驛動、外地與祿馬交馳等規則"),
  definition("地空", "凶性輔曜", "combination", "教材明示的破財與凶星聚集作用", "不推導通用星性；只允許教材明確說明的宮位／組合規則"),
]);

export const EXPLAINED_STAR_NAMES = Object.freeze(STAR_DEFINITIONS.map((item) => item.name));
export const EXPLAINED_STAR_SET = new Set(EXPLAINED_STAR_NAMES);
export const UNEXPLAINED_STAR_NAMES = Object.freeze([
  "天官", "天福", "天貴", "恩光", "台輔", "封誥", "天才", "天壽", "天廚", "天姚", "咸池",
  "龍池", "鳳閣", "華蓋", "孤辰", "寡宿", "天哭", "天虛", "天月", "陰煞", "破碎", "月德",
  "天德", "天傷", "天使", "博士", "力士", "青龍", "小耗", "將軍", "奏書", "飛廉", "喜神",
  "病符", "大耗", "伏兵", "官府", "旬中", "截路", "空亡",
]);

if (STAR_DEFINITIONS.length !== 36 || new Set(EXPLAINED_STAR_NAMES).size !== 36) {
  throw new Error("教材解釋星曜白名單必須恰好包含 36 顆不重複星曜");
}
