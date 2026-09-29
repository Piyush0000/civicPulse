import { detectLanguage } from "../ai/langdetect";

type Msgs = {
  consent: string;
  thanksConsent: string;
  received: (code: string) => string;
  understood: (cat: string, urgency: string, place: string | null) => string;
  failed: string;
  status: (code: string, status: string, cat: string) => string;
  notFound: string;
  stopped: string;
  gotLocation: string;
  city: (name: string) => string;
  smalltalk?: string;
  notActionable?: string;
};

export const MSG: Record<string, Msgs> = {
  en: {
    consent:
      "👋 Welcome to CivicPulse, the public feedback channel for city planning.\n\nWe store your message (text or voice) to plan public works. Your identity is pseudonymised, personal details are removed, and voice notes are deleted after 30 days. Send STOP anytime to opt out.\n\nReply <b>YES</b> to agree, then describe the problem and where it is (you can also share your location 📍).",
    thanksConsent: "✅ Thank you. You can now report problems anytime.",
    received: (c) => `📨 Received. Your tracking ID is <b>${c}</b>. Check anytime with: status ${c}`,
    understood: (cat, u, p) => `🧠 Understood: <b>${cat}</b>, urgency <b>${u}</b>${p ? `, near <b>${p}</b>` : ""}. It is now visible to planners.`,
    failed: "⚠️ We saved your message but could not process it automatically. An analyst will review it.",
    status: (c, s, cat) => `ℹ️ ${c}: ${cat}, status <b>${s.replace("_", " ")}</b>.`,
    notFound: "No request found with that tracking ID.",
    stopped: "You have opted out. Your contact details were deleted. Send /start to join again.",
    gotLocation: "📍 Location saved. Now describe the problem (text or voice).",
    city: (n) => `🏙️ City set to ${n}.`,
    smalltalk: "🙏 You're welcome! To report a problem, describe what is wrong and where (text or voice). Send status CP-XXXXXX to check a complaint.",
    notActionable: "🤔 I couldn't find a specific civic problem in that message. Please describe what is wrong and where, e.g. \"No water in Dwarka Sector 7 for 3 days\".",
  },
  hi: {
    consent:
      "👋 CivicPulse में आपका स्वागत है, शहर की योजना के लिए जन-सुझाव चैनल।\n\nहम आपका संदेश (टेक्स्ट या आवाज़) सार्वजनिक कार्यों की योजना के लिए सहेजते हैं। आपकी पहचान छिपाई जाती है, निजी जानकारी हटाई जाती है, और वॉइस नोट 30 दिन बाद मिटा दिए जाते हैं। कभी भी STOP भेजें।\n\nसहमति के लिए <b>हाँ</b> लिखें, फिर समस्या और जगह बताएं (लोकेशन 📍 भी भेज सकते हैं)।",
    thanksConsent: "✅ धन्यवाद। अब आप कभी भी समस्या बता सकते हैं।",
    received: (c) => `📨 मिल गया। आपका ट्रैकिंग नंबर <b>${c}</b> है। जाँचने के लिए भेजें: status ${c}`,
    understood: (cat, u, p) => `🧠 समझ गए: <b>${cat}</b>, प्राथमिकता <b>${u}</b>${p ? `, स्थान <b>${p}</b>` : ""}। अब यह योजनाकारों को दिख रहा है।`,
    failed: "⚠️ संदेश सहेज लिया गया है, एक विश्लेषक इसे देखेंगे।",
    status: (c, s, cat) => `ℹ️ ${c}: ${cat}, स्थिति <b>${s.replace("_", " ")}</b>।`,
    notFound: "इस नंबर से कोई शिकायत नहीं मिली।",
    stopped: "आपने सदस्यता छोड़ दी है। आपकी संपर्क जानकारी मिटा दी गई।",
    gotLocation: "📍 लोकेशन सहेजी गई। अब समस्या बताएं (टेक्स्ट या आवाज़)।",
    city: (n) => `🏙️ शहर: ${n}`,
    smalltalk: "🙏 धन्यवाद! समस्या बताने के लिए लिखें या बोलें कि क्या खराब है और कहाँ। स्थिति जानने के लिए भेजें: status CP-XXXXXX",
    notActionable: "🤔 इस संदेश में कोई नागरिक समस्या नहीं मिली। कृपया बताएं क्या खराब है और कहाँ, जैसे: \"द्वारका सेक्टर 7 में 3 दिन से पानी नहीं\"।",
  },
  pt: {
    consent:
      "👋 Bem-vindo ao CivicPulse, o canal de participação para o planejamento da cidade.\n\nGuardamos sua mensagem (texto ou voz) para planejar obras públicas. Sua identidade é pseudonimizada, dados pessoais são removidos e áudios são apagados após 30 dias. Envie STOP para sair.\n\nResponda <b>SIM</b> para concordar e descreva o problema e o local (pode enviar a localização 📍).",
    thanksConsent: "✅ Obrigado. Agora você pode relatar problemas a qualquer momento.",
    received: (c) => `📨 Recebido. Seu protocolo é <b>${c}</b>. Consulte com: status ${c}`,
    understood: (cat, u, p) => `🧠 Entendido: <b>${cat}</b>, urgência <b>${u}</b>${p ? `, em <b>${p}</b>` : ""}. Já está visível para os planejadores.`,
    failed: "⚠️ Mensagem salva; um analista vai revisar.",
    status: (c, s, cat) => `ℹ️ ${c}: ${cat}, situação <b>${s.replace("_", " ")}</b>.`,
    notFound: "Protocolo não encontrado.",
    stopped: "Você saiu. Seus dados de contato foram apagados.",
    gotLocation: "📍 Localização salva. Agora descreva o problema.",
    city: (n) => `🏙️ Cidade: ${n}`,
  },
  ru: {
    consent:
      "👋 Добро пожаловать в CivicPulse — канал обратной связи для городского планирования.\n\nМы сохраняем ваше сообщение (текст или голос) для планирования работ. Личность псевдонимизируется, персональные данные удаляются, голосовые удаляются через 30 дней. Отправьте STOP, чтобы отписаться.\n\nОтветьте <b>ДА</b>, затем опишите проблему и место (можно отправить геолокацию 📍).",
    thanksConsent: "✅ Спасибо. Теперь вы можете сообщать о проблемах.",
    received: (c) => `📨 Получено. Ваш номер обращения <b>${c}</b>. Проверить: status ${c}`,
    understood: (cat, u, p) => `🧠 Принято: <b>${cat}</b>, срочность <b>${u}</b>${p ? `, район <b>${p}</b>` : ""}.`,
    failed: "⚠️ Сообщение сохранено, его проверит аналитик.",
    status: (c, s, cat) => `ℹ️ ${c}: ${cat}, статус <b>${s.replace("_", " ")}</b>.`,
    notFound: "Обращение не найдено.",
    stopped: "Вы отписались. Контактные данные удалены.",
    gotLocation: "📍 Геолокация сохранена. Опишите проблему.",
    city: (n) => `🏙️ Город: ${n}`,
  },
  zh: {
    consent:
      "👋 欢迎使用 CivicPulse 城市规划民意通道。\n\n我们会保存您的留言（文字或语音）用于规划公共工程。身份经过假名化处理，个人信息会被删除，语音在30天后删除。随时发送 STOP 退出。\n\n回复 <b>是</b> 表示同意，然后描述问题和地点（也可发送位置 📍）。",
    thanksConsent: "✅ 谢谢。现在您可以随时反映问题。",
    received: (c) => `📨 已收到。您的编号是 <b>${c}</b>。查询：status ${c}`,
    understood: (cat, u, p) => `🧠 已识别：<b>${cat}</b>，紧急程度 <b>${u}</b>${p ? `，地点 <b>${p}</b>` : ""}。`,
    failed: "⚠️ 留言已保存，分析员会进行审核。",
    status: (c, s, cat) => `ℹ️ ${c}：${cat}，状态 <b>${s.replace("_", " ")}</b>。`,
    notFound: "未找到该编号。",
    stopped: "您已退出，联系方式已删除。",
    gotLocation: "📍 位置已保存，请描述问题。",
    city: (n) => `🏙️ 城市：${n}`,
  },
};

export function pickLang(code?: string, text?: string): string {
  const c = (code || "").slice(0, 2);
  if (MSG[c]) return c;
  if (text) {
    const d = detectLanguage(text).lang;
    if (MSG[d]) return d;
  }
  return "en";
}
