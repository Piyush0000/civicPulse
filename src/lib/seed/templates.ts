import type { Category, Urgency } from "../categories";

// Parallel phrase bank for synthetic citizen messages. Every phrase exists in each language, so the
// generator always knows the English pivot text for any message. "hl" = Hinglish (Hindi in Latin script).

export type TLang = "en" | "hi" | "hl" | "pt" | "ru" | "zh" | "zu";
export type P = Record<Exclude<TLang, "zu">, string> & { zu?: string };

export type Problem = {
  key: string;
  urgency: Urgency;
  sick?: boolean;
  regions?: string[]; // restrict to these region codes
  p: P;
};

export const PROBLEMS: Record<Category, Problem[]> = {
  water_supply: [
    { key: "no piped water", urgency: "high", p: { en: "There has been no water in the taps", hi: "नलों में पानी नहीं आ रहा है", hl: "nal mein paani nahi aa raha hai", pt: "Não chega água nas torneiras", ru: "нет воды в кранах", zh: "水龙头没有水", zu: "Amanzi awekho emapayipini" } },
    { key: "broken handpump", urgency: "high", regions: ["IN-DL", "BR-PE-REC", "ZA-GP-JHB"], p: { en: "The handpump has been broken", hi: "हैंडपंप खराब पड़ा है", hl: "handpump kharab pada hai", pt: "A bomba d'água comunitária está quebrada", ru: "сломана водоразборная колонка", zh: "公共水泵坏了" } },
    { key: "irregular water tanker", urgency: "medium", regions: ["IN-DL", "BR-PE-REC"], p: { en: "The water tanker has been coming only once a week", hi: "पानी का टैंकर हफ्ते में सिर्फ एक बार आ रहा है", hl: "paani ka tanker hafte mein sirf ek baar aa raha hai", pt: "O carro-pipa só tem vindo uma vez por semana", ru: "водовоз приезжает только раз в неделю", zh: "送水车一周只来一次" } },
    { key: "contaminated water", urgency: "critical", sick: true, p: { en: "Dirty, smelly water has been coming from the supply", hi: "नल से गंदा और बदबूदार पानी आ रहा है", hl: "nal se ganda aur badboodar paani aa raha hai", pt: "A água da torneira está suja e com mau cheiro", ru: "из крана идёт грязная вода с запахом", zh: "自来水又脏又臭", zu: "Amanzi angcolile" } },
    { key: "low water pressure", urgency: "medium", p: { en: "Water pressure has been extremely low", hi: "पानी का प्रेशर बहुत कम है", hl: "paani ka pressure bahut kam hai", pt: "A pressão da água está muito fraca", ru: "очень слабый напор воды", zh: "水压非常低" } },
  ],
  sanitation_drainage: [
    { key: "blocked drain", urgency: "high", sick: true, p: { en: "The drain has been blocked and overflowing", hi: "नाली जाम है और गंदा पानी सड़क पर बह रहा है", hl: "naali jam hai aur ganda paani sadak par beh raha hai", pt: "O esgoto está entupido e transbordando", ru: "засорилась канализация, всё переливается", zh: "下水道堵塞，污水外溢", zu: "Amapayipi endle avalekile" } },
    { key: "waterlogging after rain", urgency: "high", p: { en: "The street has been waterlogged after every rain", hi: "हर बारिश के बाद गली में पानी भर जाता है", hl: "har baarish ke baad gali mein paani bhar jaata hai", pt: "A rua alaga toda vez que chove", ru: "после каждого дождя улицу затапливает", zh: "每次下雨街道都被淹" } },
    { key: "no public toilet", urgency: "medium", p: { en: "There has been no working public toilet", hi: "कोई चालू सार्वजनिक शौचालय नहीं है", hl: "koi chalu public toilet nahi hai", pt: "Não há banheiro público funcionando", ru: "нет работающего общественного туалета", zh: "没有能用的公共厕所" } },
    { key: "open sewage", urgency: "critical", sick: true, p: { en: "Open sewage has been flowing next to homes", hi: "घरों के पास खुला सीवर बह रहा है", hl: "gharon ke paas khula sewer beh raha hai", pt: "Esgoto a céu aberto corre ao lado das casas", ru: "рядом с домами течёт открытая канализация", zh: "污水在住户旁边露天流淌" } },
  ],
  roads_transport: [
    { key: "potholes", urgency: "medium", p: { en: "The road has been full of deep potholes", hi: "सड़क पर गहरे गड्ढे हैं", hl: "sadak par gehre gaddhe hain", pt: "A rua está cheia de buracos", ru: "дорога вся в глубоких ямах", zh: "道路上全是深坑", zu: "Umgwaqo unezimbobo eziningi" } },
    { key: "unsafe bridge", urgency: "critical", p: { en: "The small bridge over the canal has been cracked and unsafe", hi: "नहर पर बनी पुलिया टूटी हुई और खतरनाक है", hl: "nahar wali puliya tooti hui aur khatarnak hai", pt: "A ponte sobre o canal está rachada e perigosa", ru: "мост через канал треснул и опасен", zh: "河上的小桥开裂，很危险" } },
    { key: "no bus service", urgency: "medium", p: { en: "No bus has been stopping here", hi: "यहाँ कोई बस नहीं रुकती", hl: "yahan koi bus nahi rukti", pt: "Nenhum ônibus passa por aqui", ru: "здесь не останавливается ни один автобус", zh: "这里没有公交车停靠" } },
    { key: "unpaved road", urgency: "low", p: { en: "The lane has remained unpaved and muddy", hi: "गली अब तक कच्ची और कीचड़ भरी है", hl: "gali ab tak kachchi aur keechad bhari hai", pt: "A rua continua sem calçamento e cheia de lama", ru: "улица так и не заасфальтирована, сплошная грязь", zh: "巷子一直没有硬化，全是泥" } },
  ],
  electricity: [
    { key: "long power cuts", urgency: "high", p: { en: "There have been power cuts for many hours every day", hi: "रोज़ कई घंटे बिजली कटती है", hl: "roz kai ghante bijli kat-ti hai", pt: "Falta luz por muitas horas todos os dias", ru: "свет отключают на много часов каждый день", zh: "每天停电好几个小时", zu: "Ugesi uyacishwa amahora amaningi nsuku zonke" } },
    { key: "burnt transformer", urgency: "high", p: { en: "The transformer has been burnt out", hi: "ट्रांसफार्मर जल गया है", hl: "transformer jal gaya hai", pt: "O transformador queimou", ru: "сгорел трансформатор", zh: "变压器烧坏了", zu: "Ugesi awukho, i-transformer ishile" } },
    { key: "dangling live wires", urgency: "critical", p: { en: "Live wires have been hanging low over the street", hi: "गली में बिजली के नंगे तार नीचे लटक रहे हैं", hl: "gali mein bijli ke nange taar neeche latak rahe hain", pt: "Fios elétricos soltos estão pendurados baixo na rua", ru: "над улицей низко висят оголённые провода", zh: "裸露的电线低垂在街上" } },
    { key: "voltage fluctuation", urgency: "medium", p: { en: "Voltage has been fluctuating and damaging appliances", hi: "वोल्टेज ऊपर-नीचे होने से उपकरण खराब हो रहे हैं", hl: "voltage upar-neeche hone se appliances kharab ho rahe hain", pt: "A tensão oscila e está queimando aparelhos", ru: "скачет напряжение, ломается техника", zh: "电压不稳，家电都烧坏了" } },
  ],
  health: [
    { key: "no doctor at clinic", urgency: "high", p: { en: "The local clinic has had no doctor", hi: "मोहल्ला क्लिनिक में डॉक्टर नहीं है", hl: "mohalla clinic mein doctor nahi hai", pt: "O posto de saúde está sem médico", ru: "в поликлинике нет врача", zh: "社区诊所没有医生" } },
    { key: "medicine shortage", urgency: "high", p: { en: "The health centre has run out of basic medicines", hi: "स्वास्थ्य केंद्र में ज़रूरी दवाइयाँ खत्म हैं", hl: "health centre mein zaroori dawaiyan khatam hain", pt: "O posto de saúde está sem remédios básicos", ru: "в медпункте закончились базовые лекарства", zh: "卫生服务中心缺少基本药品" } },
    { key: "fever outbreak", urgency: "critical", sick: true, p: { en: "Many people have fallen sick with high fever", hi: "बहुत से लोग तेज़ बुखार से बीमार हैं", hl: "bahut log tez bukhar se bimar hain", pt: "Muita gente está doente com febre alta", ru: "многие слегли с высокой температурой", zh: "很多人发高烧生病" } },
    { key: "hospital too far", urgency: "medium", p: { en: "The nearest hospital has been too far to reach", hi: "सबसे नज़दीकी अस्पताल बहुत दूर है", hl: "sabse nazdeeki hospital bahut door hai", pt: "O hospital mais próximo fica longe demais", ru: "ближайшая больница слишком далеко", zh: "最近的医院太远了" } },
  ],
  education: [
    { key: "overcrowded school", urgency: "medium", p: { en: "The government school has been badly overcrowded", hi: "सरकारी स्कूल में क्लास में बहुत ज़्यादा बच्चे हैं", hl: "sarkari school mein class mein bahut zyada bachche hain", pt: "A escola está superlotada", ru: "школа переполнена, классы огромные", zh: "学校人满为患，班级太大" } },
    { key: "teacher shortage", urgency: "high", p: { en: "The school has had no teachers for key subjects", hi: "स्कूल में कई विषयों के शिक्षक नहीं हैं", hl: "school mein kai subjects ke teacher nahi hain", pt: "A escola está sem professores de várias matérias", ru: "в школе нет учителей по нескольким предметам", zh: "学校缺好几门课的老师" } },
    { key: "leaking school roof", urgency: "high", p: { en: "The school building roof has been leaking", hi: "स्कूल की छत टपक रही है", hl: "school ki chhat tapak rahi hai", pt: "O telhado da escola está com goteiras", ru: "протекает крыша школы", zh: "学校屋顶漏水" } },
    { key: "no secondary school nearby", urgency: "medium", p: { en: "There has been no secondary school nearby", hi: "पास में कोई सेकेंडरी स्कूल नहीं है", hl: "paas mein koi secondary school nahi hai", pt: "Não há escola de ensino médio por perto", ru: "поблизости нет средней школы", zh: "附近没有中学" } },
  ],
  housing: [
    { key: "leaking homes", urgency: "medium", p: { en: "Our houses have been leaking badly whenever it rains", hi: "बारिश में हमारे घरों की छतें टपकती हैं", hl: "baarish mein hamare gharon ki chhatein tapakti hain", pt: "Nossas casas ficam com goteiras sempre que chove", ru: "в домах течёт крыша при каждом дожде", zh: "一下雨我们家就漏水", zu: "Imizi yethu iyavuza uma lina" } },
    { key: "eviction threat", urgency: "high", p: { en: "Families have been living under threat of eviction", hi: "परिवारों पर बेदखली का खतरा है", hl: "pariwaron par bedakhli ka khatra hai", pt: "Famílias estão sob ameaça de despejo", ru: "семьям грозит выселение", zh: "住户面临被强制搬迁" } },
    { key: "no heating", urgency: "high", regions: ["RU-TA-KZN", "CN-SC-CTU"], p: { en: "The building has had no heating", hi: "इमारत में हीटिंग नहीं है", hl: "building mein heating nahi hai", pt: "O prédio está sem aquecimento", ru: "в доме нет отопления", zh: "楼里没有暖气" } },
    { key: "dangerous building cracks", urgency: "critical", p: { en: "The old building has developed dangerous cracks", hi: "पुरानी इमारत में खतरनाक दरारें आ गई हैं", hl: "purani building mein khatarnak daraarein aa gayi hain", pt: "O prédio antigo está com rachaduras perigosas", ru: "в старом доме появились опасные трещины", zh: "老楼出现了危险的裂缝" } },
  ],
  waste_management: [
    { key: "garbage not collected", urgency: "medium", sick: true, p: { en: "Garbage has not been collected", hi: "कूड़ा नहीं उठाया गया है", hl: "kooda nahi uthaya gaya hai", pt: "O lixo não é recolhido", ru: "мусор не вывозят", zh: "垃圾没人清运", zu: "Imfucuza ayiqoqwa" } },
    { key: "illegal dump", urgency: "medium", p: { en: "An open garbage dump has formed", hi: "खुले में कूड़े का ढेर लग गया है", hl: "khule mein kude ka dher lag gaya hai", pt: "Formou-se um lixão a céu aberto", ru: "образовалась стихийная свалка", zh: "形成了露天垃圾堆" } },
    { key: "garbage burning", urgency: "high", sick: true, p: { en: "People have been burning garbage and the smoke is choking us", hi: "लोग कूड़ा जला रहे हैं और धुएं से सांस लेना मुश्किल है", hl: "log kooda jala rahe hain aur dhuen se saans lena mushkil hai", pt: "Estão queimando lixo e a fumaça está sufocando a gente", ru: "жгут мусор, дышать невозможно от дыма", zh: "有人焚烧垃圾，烟呛得人喘不过气" } },
  ],
  public_safety_lighting: [
    { key: "streetlights out", urgency: "medium", p: { en: "The streetlights have not been working", hi: "स्ट्रीट लाइटें खराब हैं", hl: "street lights kharab hain", pt: "Os postes de luz estão apagados", ru: "не работает уличное освещение", zh: "路灯不亮", zu: "Izibani zasemgwaqweni azisebenzi" } },
    { key: "unsafe at night", urgency: "high", p: { en: "The area has been unsafe for women at night", hi: "रात में महिलाओं के लिए इलाका असुरक्षित है", hl: "raat mein mahilaon ke liye ilaka unsafe hai", pt: "A área está perigosa para mulheres à noite", ru: "ночью здесь небезопасно для женщин", zh: "晚上这里对女性很不安全" } },
    { key: "repeated thefts", urgency: "low", p: { en: "There have been repeated thefts and no CCTV", hi: "बार-बार चोरी हो रही है और कोई सीसीटीवी नहीं है", hl: "baar-baar chori ho rahi hai aur koi CCTV nahi hai", pt: "Há roubos frequentes e nenhuma câmera", ru: "постоянные кражи, камер нет", zh: "经常发生盗窃，没有监控" } },
  ],
  digital_connectivity: [
    { key: "no mobile signal", urgency: "medium", p: { en: "There has been no mobile signal", hi: "मोबाइल नेटवर्क नहीं आता", hl: "mobile network nahi aata", pt: "Não tem sinal de celular", ru: "нет мобильной связи", zh: "手机没有信号" } },
    { key: "no internet for students", urgency: "low", p: { en: "Students have had no internet access for online classes", hi: "बच्चों के पास ऑनलाइन पढ़ाई के लिए इंटरनेट नहीं है", hl: "bachchon ke paas online padhai ke liye internet nahi hai", pt: "Os estudantes não têm internet para as aulas online", ru: "у школьников нет интернета для учёбы", zh: "学生上网课没有网络" } },
    { key: "service centre closed", urgency: "medium", p: { en: "The citizen service centre has been closed", hi: "जन सेवा केंद्र बंद पड़ा है", hl: "jan seva kendra band pada hai", pt: "O posto de atendimento ao cidadão está fechado", ru: "центр госуслуг закрыт", zh: "政务服务点一直关着" } },
  ],
  agriculture_irrigation: [
    { key: "dry irrigation canal", urgency: "high", p: { en: "The irrigation canal has been dry", hi: "सिंचाई की नहर सूखी पड़ी है", hl: "sinchai ki nahar sookhi padi hai", pt: "O canal de irrigação está seco", ru: "оросительный канал пересох", zh: "灌溉渠干了" } },
    { key: "garden without water", urgency: "low", p: { en: "The community garden has had no water connection", hi: "सामुदायिक बगीचे में पानी का कनेक्शन नहीं है", hl: "community garden mein paani ka connection nahi hai", pt: "A horta comunitária está sem ligação de água", ru: "у общественного огорода нет подключения к воде", zh: "社区菜园没有接水" } },
  ],
  other: [
    { key: "stray animals", urgency: "low", p: { en: "Stray dogs have been attacking people", hi: "आवारा कुत्ते लोगों पर हमला कर रहे हैं", hl: "aawara kutte logon par hamla kar rahe hain", pt: "Cachorros soltos estão atacando pessoas", ru: "бродячие собаки нападают на людей", zh: "流浪狗咬人" } },
    { key: "noise pollution", urgency: "low", p: { en: "Loud noise from a factory has continued day and night", hi: "फैक्ट्री का शोर दिन-रात चलता है", hl: "factory ka shor din-raat chalta hai", pt: "O barulho de uma fábrica continua dia e noite", ru: "шум от завода не прекращается днём и ночью", zh: "工厂噪音日夜不停" } },
  ],
};

export const LANDMARKS: P[] = [
  { en: "near the government school", hi: "सरकारी स्कूल के पास", hl: "sarkari school ke paas", pt: "perto da escola municipal", ru: "возле школы", zh: "学校附近", zu: "eduze kwesikole" },
  { en: "near the main market", hi: "मेन मार्केट के पास", hl: "main market ke paas", pt: "perto da feira", ru: "возле рынка", zh: "菜市场附近", zu: "eduze kwemakethe" },
  { en: "by the bus stop", hi: "बस स्टॉप के पास", hl: "bus stop ke paas", pt: "perto do ponto de ônibus", ru: "у автобусной остановки", zh: "公交站旁边", zu: "eduze kwesitobhi samabhasi" },
  { en: "near the community hall", hi: "सामुदायिक भवन के पास", hl: "community hall ke paas", pt: "perto do centro comunitário", ru: "возле дома культуры", zh: "社区活动中心附近", zu: "eduze kwehholo lomphakathi" },
  { en: "near the health centre", hi: "डिस्पेंसरी के पास", hl: "dispensary ke paas", pt: "perto do posto de saúde", ru: "возле поликлиники", zh: "卫生院附近", zu: "eduze komtholampilo" },
  { en: "next to the park", hi: "पार्क के पास", hl: "park ke paas", pt: "ao lado da praça", ru: "рядом с парком", zh: "公园旁边", zu: "eduze nepaki" },
  { en: "in Block C", hi: "सी ब्लॉक में", hl: "C block mein", pt: "na Rua Três", ru: "во дворе дома 12", zh: "3号楼附近", zu: "ku-Extension 2" },
];

export const IMPACTS: P[] = [
  { en: "Hundreds of families are affected.", hi: "सैकड़ों परिवार परेशान हैं।", hl: "Sainkdon parivaar pareshaan hain.", pt: "Centenas de famílias são afetadas.", ru: "Страдают сотни семей.", zh: "几百户居民受到影响。", zu: "Imindeni eminingi iyahlupheka." },
  { en: "Children and old people suffer the most.", hi: "बच्चे और बुज़ुर्ग सबसे ज़्यादा परेशान हैं।", hl: "Bachche aur buzurg sabse zyada pareshaan hain.", pt: "Crianças e idosos são os que mais sofrem.", ru: "Больше всего страдают дети и пожилые.", zh: "老人和孩子最受罪。", zu: "Izingane nabadala bahlupheka kakhulu." },
  { en: "We have complained many times but nothing happened.", hi: "कई बार शिकायत की पर कुछ नहीं हुआ।", hl: "Kai baar complaint ki par kuch nahi hua.", pt: "Já reclamamos várias vezes e nada foi feito.", ru: "Жаловались много раз, но ничего не изменилось.", zh: "反映了很多次都没有解决。", zu: "Sesikhalaze kaningi kodwa akukho okwenzekile." },
  { en: "Daily life has become very difficult.", hi: "रोज़ की ज़िंदगी बहुत मुश्किल हो गई है।", hl: "Roz ki zindagi bahut mushkil ho gayi hai.", pt: "O dia a dia ficou muito difícil.", ru: "Жить стало очень тяжело.", zh: "日常生活非常困难。", zu: "Impilo yansuku zonke isinzima kakhulu." },
];

export const SICK_IMPACT: P = { en: "Children are falling sick.", hi: "बच्चे बीमार पड़ रहे हैं।", hl: "Bachche bimar pad rahe hain.", pt: "As crianças estão ficando doentes.", ru: "Дети начали болеть.", zh: "孩子们开始生病了。", zu: "Izingane ziyagula." };

export const OPENERS: Record<TLang, string[]> = {
  en: ["", "", "Sir/Madam, ", "Please help. ", "Respected officer, "],
  hi: ["", "", "महोदय, ", "कृपया मदद करें। ", "नमस्ते, "],
  hl: ["", "", "Sir, ", "Please help karo. ", "Namaste, "],
  pt: ["", "", "Bom dia, ", "Por favor, ", "Prezados, "],
  ru: ["", "", "Здравствуйте! ", "Помогите, пожалуйста. ", "Уважаемая администрация! "],
  zh: ["", "", "您好，", "请帮帮我们，", "尊敬的领导，"],
  zu: ["", "Sawubona, ", "Siyacela, "],
};

export const CLOSERS: Record<TLang, string[]> = {
  en: ["", "Please fix it soon.", "Kindly take action urgently."],
  hi: ["", "जल्दी ठीक करवाइए।", "कृपया तुरंत कार्रवाई करें।"],
  hl: ["", "Jaldi theek karwao.", "Please jaldi action lo."],
  pt: ["", "Pedimos providências.", "Por favor, resolvam logo."],
  ru: ["", "Просим принять меры.", "Пожалуйста, решите вопрос."],
  zh: ["", "请尽快解决。", "希望有关部门重视。"],
  zu: ["", "Siyacela nisisize ngokushesha."],
};

export const SPAM: Partial<Record<TLang, string[]>> = {
  en: ["Earn money from home daily, click this link now", "Happy festival to everyone!", "Who will win the match tonight?"],
  hi: ["सबको त्योहार की शुभकामनाएं", "घर बैठे पैसे कमाएं, अभी लिंक पर क्लिक करें"],
  hl: ["Sabko happy festival!", "Ghar baithe paise kamao, link pe click karo"],
  pt: ["Ganhe dinheiro fácil, clique no link", "Bom dia grupo!"],
  ru: ["Выиграй телефон, переходи по ссылке", "Всем доброе утро!"],
  zh: ["加微信领红包", "大家早上好"],
};

export const NON_ACTIONABLE: P = {
  en: "The government never does anything for us.",
  hi: "सरकार हमारे लिए कुछ नहीं करती।",
  hl: "Sarkar hamare liye kuch nahi karti.",
  pt: "O governo nunca faz nada por nós.",
  ru: "Власти ничего для нас не делают.",
  zh: "政府什么都不管。",
};

type Unit = "day" | "week" | "month";

function ruPlural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function duration(lang: TLang, n: number, unit: Unit): string {
  switch (lang) {
    case "en":
      return `for ${n} ${unit}${n === 1 ? "" : "s"}`;
    case "hi":
      return `पिछले ${n} ${{ day: "दिनों", week: "हफ़्तों", month: "महीनों" }[unit]} से`;
    case "hl":
      return `pichhle ${n} ${{ day: "dinon", week: "hafton", month: "mahinon" }[unit]} se`;
    case "pt":
      return `há ${n} ${{ day: n === 1 ? "dia" : "dias", week: n === 1 ? "semana" : "semanas", month: n === 1 ? "mês" : "meses" }[unit]}`;
    case "ru": {
      const w = {
        day: ruPlural(n, "день", "дня", "дней"),
        week: ruPlural(n, "неделю", "недели", "недель"),
        month: ruPlural(n, "месяц", "месяца", "месяцев"),
      }[unit];
      return `уже ${n} ${w}`;
    }
    case "zh":
      return `已经${n}${{ day: "天", week: "个星期", month: "个月" }[unit]}`;
    case "zu":
      return { day: `izinsuku ezi-${n}`, week: `amaviki angu-${n}`, month: `izinyanga ezi-${n}` }[unit];
  }
}

export function locationPhrase(lang: TLang, locality: string, landmark: P | null): string {
  const lm = landmark ? (landmark[lang as keyof P] ?? landmark.en) : "";
  switch (lang) {
    case "en":
      return lm ? `${lm} in ${locality}` : `in ${locality}`;
    case "hi":
      return lm ? `${locality} में ${lm}` : `${locality} में`;
    case "hl":
      return lm ? `${locality} mein ${lm}` : `${locality} mein`;
    case "pt":
      return lm ? `${lm}, no bairro ${locality},` : `no bairro ${locality}`;
    case "ru":
      return lm ? `в районе ${locality} ${lm}` : `в районе ${locality}`;
    case "zh":
      return `${locality}${lm}`;
    case "zu":
      return lm ? `${lm} e-${locality}` : `e-${locality}`;
  }
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/\s+([.,。，!])/g, "$1").replace(/,\./g, ".").trim();

/** Assemble one sentence in the language's natural word order. */
export function assemble(
  lang: TLang,
  parts: { opener: string; problem: string; loc: string; dur: string; impact: string; closer: string },
): string {
  const { opener, problem, loc, dur, impact, closer } = parts;
  switch (lang) {
    case "en":
    case "pt":
    case "zu": {
      // After "Sir/Madam," the sentence continues in lower case; after "Please help." it starts anew.
      const head = opener.trim().endsWith(",") ? problem[0].toLowerCase() + problem.slice(1) : cap(problem);
      return tidy(`${opener}${head} ${loc} ${dur}. ${impact} ${closer}`);
    }
    case "hi":
      return tidy(`${opener}${loc} ${dur} ${problem}। ${impact} ${closer}`);
    case "hl":
      return tidy(`${opener}${cap(`${loc} ${dur} ${problem}`.trim())}. ${impact} ${closer}`);
    case "ru":
      return tidy(`${opener}${cap(`${loc} ${dur} ${problem}`.trim())}. ${impact} ${closer}`);
    case "zh":
      return `${opener}${loc}${dur}${problem}。${impact}${closer}`.replace(/\s+/g, "");
  }
}
