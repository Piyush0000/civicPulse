// Citizen-facing copy in the five pilot languages. Dashboard copy stays English (structured for more).

export const UI_LANGS = [
  { code: "en", label: "English", speech: "en-IN" },
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
  { code: "pt", label: "Português", speech: "pt-BR" },
  { code: "ru", label: "Русский", speech: "ru-RU" },
  { code: "zh", label: "中文", speech: "zh-CN" },
] as const;
export type UiLang = (typeof UI_LANGS)[number]["code"];

type Dict = {
  title: string;
  subtitle: string;
  city: string;
  describe: string;
  placeholder: string;
  record: string;
  stop: string;
  recording: string;
  heard: string;
  location: string;
  useMyLocation: string;
  locating: string;
  locationSet: string;
  consent: string;
  submit: string;
  sending: string;
  offlineQueued: string;
  thanks: string;
  yourCode: string;
  copy: string;
  copied: string;
  track: string;
  another: string;
  trackTitle: string;
  steps: Record<"received" | "understood" | "under_review" | "linked_to_project" | "resolved", string>;
  neighbours: (n: number) => string;
  enterCode: string;
  privacy: string;
};

export const T: Record<UiLang, Dict> = {
  en: {
    title: "Tell your city what needs fixing",
    subtitle: "Speak or type in your language. We turn every voice into evidence for public investment.",
    city: "City",
    describe: "What is the problem, and where?",
    placeholder: "e.g. The handpump near the school in Sangam Vihar has been broken for 3 weeks…",
    record: "Hold nothing, just tap to speak",
    stop: "Stop recording",
    recording: "Listening…",
    heard: "We heard",
    location: "Location (optional, helps a lot)",
    useMyLocation: "Use my location",
    locating: "Locating…",
    locationSet: "Location attached",
    consent: "I agree that this message is stored to plan public works. My identity is pseudonymised, personal details are removed, and voice notes are deleted after 30 days.",
    submit: "Send to my city",
    sending: "Sending…",
    offlineQueued: "You are offline. Your report is saved and will be sent automatically when you reconnect.",
    thanks: "Thank you! Your voice is on the map.",
    yourCode: "Your tracking ID",
    copy: "Copy",
    copied: "Copied",
    track: "Track status",
    another: "Report another problem",
    trackTitle: "Track your request",
    steps: { received: "Received", understood: "Understood by AI", under_review: "Under review", linked_to_project: "Linked to a project", resolved: "Resolved" },
    neighbours: (n) => `${n} neighbour${n === 1 ? " has" : "s have"} reported the same issue.`,
    enterCode: "Enter tracking ID",
    privacy: "No account needed. We never show your name or number to anyone.",
  },
  hi: {
    title: "अपने शहर को बताइए क्या ठीक करना है",
    subtitle: "अपनी भाषा में बोलिए या लिखिए। हम हर आवाज़ को सार्वजनिक निवेश के सबूत में बदलते हैं।",
    city: "शहर",
    describe: "समस्या क्या है, और कहाँ?",
    placeholder: "जैसे: संगम विहार में स्कूल के पास हैंडपंप 3 हफ़्ते से खराब है…",
    record: "बोलने के लिए दबाइए",
    stop: "रिकॉर्डिंग रोकें",
    recording: "सुन रहे हैं…",
    heard: "हमने सुना",
    location: "जगह (वैकल्पिक, बहुत मदद करती है)",
    useMyLocation: "मेरी लोकेशन लें",
    locating: "लोकेशन ढूंढ रहे हैं…",
    locationSet: "लोकेशन जुड़ गई",
    consent: "मैं सहमत हूँ कि यह संदेश सार्वजनिक कार्यों की योजना के लिए सहेजा जाए। मेरी पहचान छिपाई जाएगी, निजी जानकारी हटाई जाएगी, और वॉइस नोट 30 दिन बाद मिटा दिए जाएँगे।",
    submit: "शहर को भेजें",
    sending: "भेज रहे हैं…",
    offlineQueued: "आप ऑफ़लाइन हैं। आपकी शिकायत सहेज ली गई है और इंटरनेट आते ही भेज दी जाएगी।",
    thanks: "धन्यवाद! आपकी आवाज़ नक्शे पर है।",
    yourCode: "आपका ट्रैकिंग नंबर",
    copy: "कॉपी",
    copied: "कॉपी हो गया",
    track: "स्थिति देखें",
    another: "एक और समस्या बताएं",
    trackTitle: "अपनी शिकायत की स्थिति",
    steps: { received: "प्राप्त", understood: "AI ने समझा", under_review: "समीक्षा में", linked_to_project: "परियोजना से जुड़ी", resolved: "हल हुई" },
    neighbours: (n) => `${n} पड़ोसियों ने भी यही समस्या बताई है।`,
    enterCode: "ट्रैकिंग नंबर डालें",
    privacy: "कोई खाता नहीं चाहिए। आपका नाम या नंबर किसी को नहीं दिखाया जाता।",
  },
  pt: {
    title: "Diga à sua cidade o que precisa ser consertado",
    subtitle: "Fale ou escreva no seu idioma. Transformamos cada voz em evidência para o investimento público.",
    city: "Cidade",
    describe: "Qual é o problema, e onde?",
    placeholder: "ex.: A rua alaga toda vez que chove no bairro Ibura…",
    record: "Toque para falar",
    stop: "Parar gravação",
    recording: "Ouvindo…",
    heard: "Ouvimos",
    location: "Localização (opcional, ajuda muito)",
    useMyLocation: "Usar minha localização",
    locating: "Localizando…",
    locationSet: "Localização anexada",
    consent: "Concordo que esta mensagem seja guardada para planejar obras públicas. Minha identidade é pseudonimizada, dados pessoais são removidos e áudios são apagados após 30 dias.",
    submit: "Enviar para a cidade",
    sending: "Enviando…",
    offlineQueued: "Você está sem internet. O relato foi salvo e será enviado automaticamente.",
    thanks: "Obrigado! Sua voz está no mapa.",
    yourCode: "Seu protocolo",
    copy: "Copiar",
    copied: "Copiado",
    track: "Acompanhar",
    another: "Relatar outro problema",
    trackTitle: "Acompanhe seu pedido",
    steps: { received: "Recebido", understood: "Entendido pela IA", under_review: "Em análise", linked_to_project: "Ligado a um projeto", resolved: "Resolvido" },
    neighbours: (n) => `${n} vizinho(s) relataram o mesmo problema.`,
    enterCode: "Digite o protocolo",
    privacy: "Sem cadastro. Nunca mostramos seu nome ou número.",
  },
  ru: {
    title: "Расскажите городу, что нужно исправить",
    subtitle: "Говорите или пишите на своём языке. Каждый голос становится аргументом для городских инвестиций.",
    city: "Город",
    describe: "В чём проблема и где?",
    placeholder: "например: В районе Азино уже 3 недели дорога вся в ямах…",
    record: "Нажмите, чтобы говорить",
    stop: "Остановить запись",
    recording: "Слушаем…",
    heard: "Мы услышали",
    location: "Место (необязательно, но очень помогает)",
    useMyLocation: "Моё местоположение",
    locating: "Определяем…",
    locationSet: "Место добавлено",
    consent: "Я согласен(на), что сообщение сохраняется для планирования работ. Личность псевдонимизируется, персональные данные удаляются, голосовые удаляются через 30 дней.",
    submit: "Отправить",
    sending: "Отправляем…",
    offlineQueued: "Нет сети. Обращение сохранено и будет отправлено автоматически.",
    thanks: "Спасибо! Ваш голос на карте.",
    yourCode: "Номер обращения",
    copy: "Копировать",
    copied: "Скопировано",
    track: "Статус",
    another: "Сообщить о другой проблеме",
    trackTitle: "Статус обращения",
    steps: { received: "Получено", understood: "Распознано ИИ", under_review: "На рассмотрении", linked_to_project: "Включено в проект", resolved: "Решено" },
    neighbours: (n) => `Соседи (${n}) сообщили о той же проблеме.`,
    enterCode: "Введите номер",
    privacy: "Регистрация не нужна. Ваше имя и номер никому не показываются.",
  },
  zh: {
    title: "告诉你的城市，哪里需要修",
    subtitle: "用你的语言说或写。我们把每一个声音变成公共投资的依据。",
    city: "城市",
    describe: "什么问题？在哪里？",
    placeholder: "例如：金牛区每次下雨街道都被淹……",
    record: "点击说话",
    stop: "停止录音",
    recording: "正在听……",
    heard: "我们听到",
    location: "位置（可选，很有帮助）",
    useMyLocation: "使用我的位置",
    locating: "定位中……",
    locationSet: "已添加位置",
    consent: "我同意保存此留言用于规划公共工程。身份经过假名化处理，个人信息会被删除，语音在30天后删除。",
    submit: "提交",
    sending: "提交中……",
    offlineQueued: "当前离线。留言已保存，联网后会自动提交。",
    thanks: "谢谢！你的声音已出现在地图上。",
    yourCode: "你的编号",
    copy: "复制",
    copied: "已复制",
    track: "查看进度",
    another: "反映其他问题",
    trackTitle: "查询进度",
    steps: { received: "已收到", understood: "AI 已识别", under_review: "审核中", linked_to_project: "已纳入项目", resolved: "已解决" },
    neighbours: (n) => `已有 ${n} 位邻居反映了同样的问题。`,
    enterCode: "输入编号",
    privacy: "无需注册。我们不会向任何人展示你的姓名或号码。",
  },
};
