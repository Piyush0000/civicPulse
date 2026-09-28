// Citizen-facing copy in the pilot languages. Dashboard copy stays English (structured for more).

export const UI_LANGS = [
  { code: "en", label: "English", speech: "en-IN" },
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
  { code: "mr", label: "मराठी", speech: "mr-IN" },
  { code: "ta", label: "தமிழ்", speech: "ta-IN" },
  { code: "te", label: "తెలుగు", speech: "te-IN" },
  { code: "bn", label: "বাংলা", speech: "bn-IN" },
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
    record: "Tap to speak",
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
  mr: {
    title: "तुमच्या शहराला सांगा काय दुरुस्त करायचे आहे",
    subtitle: "तुमच्या भाषेत बोला किंवा लिहा. आम्ही प्रत्येक आवाज सार्वजनिक गुंतवणुकीचा पुरावा बनवतो.",
    city: "शहर",
    describe: "काय समस्या आहे, आणि कुठे?",
    placeholder: "उदा. संगम विहारमधील शाळेजवळील हातपंप ३ आठवड्यांपासून बंद आहे…",
    record: "बोलण्यासाठी दाबा",
    stop: "रेकॉर्डिंग थांबवा",
    recording: "ऐकत आहोत…",
    heard: "आम्ही ऐकले",
    location: "ठिकाण (ऐच्छिक, खूप मदत करते)",
    useMyLocation: "माझे लोकेशन वापरा",
    locating: "लोकेशन शोधत आहोत…",
    locationSet: "लोकेशन जोडले",
    consent: "हा संदेश सार्वजनिक कामांच्या नियोजनासाठी जतन करण्यास माझी सहमती आहे. माझी ओळख लपवली जाईल, वैयक्तिक माहिती काढली जाईल आणि ऑडिओ ३० दिवसांनंतर हटवला जाईल.",
    submit: "शहराला पाठवा",
    sending: "पाठवत आहोत…",
    offlineQueued: "तुम्ही ऑफलाइन आहात. तुमची तक्रार जतन केली आहे आणि इंटरनेट आल्यावर आपोआप पाठवली जाईल.",
    thanks: "धन्यवाद! तुमचा आवाज नकाशावर आहे.",
    yourCode: "तुमचा ट्रॅकिंग आयडी",
    copy: "कॉपी करा",
    copied: "कॉपी झाले",
    track: "स्थिती पहा",
    another: "दुसरी समस्या सांगा",
    trackTitle: "तुमच्या तक्रारीची स्थिती",
    steps: { received: "मिळाले", understood: "एआयने समजले", under_review: "तपासणी सुरू आहे", linked_to_project: "प्रकल्पाशी जोडले", resolved: "सोडवले" },
    neighbours: (n) => `${n} शेजाऱ्यांनी हीच समस्या नोंदवली आहे.`,
    enterCode: "ट्रॅकिंग आयडी टाका",
    privacy: "कोणत्याही खात्याची गरज नाही. तुमचे नाव किंवा नंबर कोणालाही दाखवला जात नाही.",
  },
  ta: {
    title: "உங்கள் நகரத்திற்கு என்ன சரிசெய்ய வேண்டும் என்று சொல்லுங்கள்",
    subtitle: "உங்கள் மொழியில் பேசவும் அல்லது எழுதவும். பொது முதலீட்டுக்கான ஆதாரமாக ஒவ்வொரு குரலையும் மாற்றுகிறோம்.",
    city: "நகரம்",
    describe: "என்ன பிரச்சனை, எங்கே?",
    placeholder: "உதாரணமாக: சங்கம் விஹாரில் பள்ளியருகில் உள்ள கைப்பம்பு 3 வாரங்களாக பழுதடைந்துள்ளது…",
    record: "பேச அழுத்தவும்",
    stop: "ரெக்கார்டிங் நிறுத்தவும்",
    recording: "கவனிக்கிறோம்…",
    heard: "நாங்கள் கேட்டது",
    location: "இடம் (விருப்பத்தேர்வு, மிகவும் உதவும்)",
    useMyLocation: "எனது இருப்பிடத்தைப் பயன்படுத்து",
    locating: "இடத்தைக் கண்டறிகிறது…",
    locationSet: "இடம் இணைக்கப்பட்டது",
    consent: "பொதுப்பணித் திட்டமிடலுக்காக இந்தச் செய்தி சேமிக்கப்படுவதை நான் ஏற்கிறேன். எனது அடையாளம் மறைக்கப்படும், தனிப்பட்ட விவரங்கள் நீக்கப்படும், மேலும் ஆடியோ 30 நாட்களுக்குப் பிறகு அழிக்கப்படும்.",
    submit: "நகரத்திற்கு அனுப்பு",
    sending: "அனுப்புகிறது…",
    offlineQueued: "நீங்கள் ஆஃப்லைனில் உள்ளீர்கள். உங்கள் புகார் சேமிக்கப்பட்டது, இணையம் கிடைத்ததும் தானாகவே அனுப்பப்படும்.",
    thanks: "நன்றி! உங்கள் குரல் வரைபடத்தில் உள்ளது.",
    yourCode: "உங்கள் டிராக்கிங் ஐடி",
    copy: "காப்பி",
    copied: "காப்பி செய்யப்பட்டது",
    track: "நிலையை அறிய",
    another: "மற்றொரு பிரச்சனையை தெரிவி",
    trackTitle: "உங்கள் கோரிக்கையின் நிலை",
    steps: { received: "பெறப்பட்டது", understood: "ஏஐ புரிந்துகொண்டது", under_review: "பரிசீலனையில்", linked_to_project: "திட்டத்துடன் இணைக்கப்பட்டது", resolved: "தீர்க்கப்பட்டது" },
    neighbours: (n) => `${n} அண்டை வீட்டாரும் இதே பிரச்சனையை தெரிவித்துள்ளனர்.`,
    enterCode: "டிராக்கிங் ஐடியை உள்ளிடுக",
    privacy: "கணக்கு எதுவும் தேவையில்லை. உங்கள் பெயர் அல்லது எண் யாருக்கும் காட்டப்பட மாட்டாது.",
  },
  te: {
    title: "మీ నగరంలో ఏం సరిచేయాలో చెప్పండి",
    subtitle: "మీ భాషలో మాట్లాడండి లేదా రాయండి. మీ ప్రతి వాయిస్‌ని ప్రజా పెట్టుబడికి సాక్ష్యంగా మారుస్తాం.",
    city: "నగరం",
    describe: "సమస్య ఏమిటి, ఎక్కడ?",
    placeholder: "ఉదాహరణకు: గచ్చిబౌలిలో స్కూల్ దగ్గర ఉన్న వాటర్ పంప్ 3 వారాలుగా పనిచేయడం లేదు…",
    record: "మాట్లాడేందుకు నొక్కండి",
    stop: "రికార్డింగ్ ఆపండి",
    recording: "వింటున్నాము…",
    heard: "మేము విన్నాము",
    location: "ప్రదేశం (ఆప్షనల్, చాలా సహాయపడుతుంది)",
    useMyLocation: "నా లొకేషన్ వాడండి",
    locating: "లొకేషన్ వెతుకుతున్నాము…",
    locationSet: "లొకేషన్ యాడ్ చేయబడింది",
    consent: "ప్రజా పనుల ప్లానింగ్ కోసం ఈ సందేశాన్ని దాచుకోవడానికి నేను అంగీకరిస్తున్నాను. నా గుర్తింపు గోప్యంగా ఉంచబడుతుంది, వ్యక్తిగత వివరాలు తీసివేయబడతాయి, వాయిస్ నోట్స్ 30 రోజుల తర్వాత తొలగించబడతాయి.",
    submit: "నగరానికి పంపండి",
    sending: "పంపుతున్నాము…",
    offlineQueued: "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు. మీ కంప్లైంట్ సేవ్ చేయబడింది, ఇంటర్నెట్ రాగానే ఆటోమేటిక్‌గా పంపబడుతుంది.",
    thanks: "ధన్యవాదాలు! మీ వాయిస్ మ్యాప్‌లో యాడ్ అయింది.",
    yourCode: "మీ ట్రాకింగ్ ఐడీ",
    copy: "కాపీ",
    copied: "కాపీ చేయబడింది",
    track: "స్టేటస్ చూడండి",
    another: "మరో సమస్యను చెప్పండి",
    trackTitle: "మీ రిక్వెస్ట్ స్టేటస్",
    steps: { received: "అందింది", understood: "AI అర్థం చేసుకుంది", under_review: "పరిశీలనలో ఉంది", linked_to_project: "ప్రాజెక్టుకు లింక్ చేయబడింది", resolved: "పరిష్కరించబడింది" },
    neighbours: (n) => `${n} మంది ఇరుగుపొరుగు వారు కూడా ఇదే సమస్యను చెప్పారు.`,
    enterCode: "ట్రాకింగ్ ఐడీ ఎంటర్ చేయండి",
    privacy: "ఖాతా అవసరం లేదు. మీ పేరు లేదా నంబర్ ఎవరికీ చూపబడదు.",
  },
  bn: {
    title: "আপনার শহরে কী সমস্যা আছে তা জানান",
    subtitle: "আপনার ভাষায় কথা বলুন বা লিখুন। আমরা প্রতিটি ভয়েসকে জনস্বার্থে কাজের প্রমাণ হিসেবে তুলে ধরি।",
    city: "শহর",
    describe: "সমস্যাটি কী এবং কোথায়?",
    placeholder: "যেমন: সল্ট লেকে স্কুলের কাছে টিউবওয়েলটি ৩ সপ্তাহ ধরে খারাপ…",
    record: "কথা বলতে ট্যাপ করুন",
    stop: "রেকর্ডিং থামান",
    recording: "শুনছি…",
    heard: "আমরা শুনেছি",
    location: "অবস্থান (ঐচ্ছিক, খুব সাহায্য করে)",
    useMyLocation: "আমার অবস্থান ব্যবহার করুন",
    locating: "অবস্থান খুঁজছি…",
    locationSet: "অবস্থান যোগ করা হয়েছে",
    consent: "জনস্বার্থে কাজের পরিকল্পনার জন্য এই মেসেজটি সংরক্ষণ করতে আমি সম্মত। আমার পরিচয় গোপন রাখা হবে, ব্যক্তিগত তথ্য মুছে ফেলা হবে এবং ৩০ দিন পর ভয়েস নোট মুছে ফেলা হবে।",
    submit: "শহরে পাঠান",
    sending: "পাঠানো হচ্ছে…",
    offlineQueued: "আপনি অফলাইনে আছেন। আপনার রিপোর্ট সংরক্ষণ করা হয়েছে এবং ইন্টারনেট কানেকশন এলে নিজে থেকেই পাঠানো হবে।",
    thanks: "ধন্যবাদ! আপনার ভয়েস ম্যাপে যোগ করা হয়েছে।",
    yourCode: "আপনার ট্র্যাকিং আইডি",
    copy: "কপি করুন",
    copied: "কপি হয়েছে",
    track: "স্ট্যাটাস দেখুন",
    another: "অন্য সমস্যা জানান",
    trackTitle: "আপনার রিপোর্টের স্ট্যাটাস",
    steps: { received: "পাওয়া গেছে", understood: "এআই বুঝতে পেরেছে", under_review: "পর্যালোচনা চলছে", linked_to_project: "প্রজেক্টের সাথে যুক্ত করা হয়েছে", resolved: "সমাধান হয়েছে" },
    neighbours: (n) => `${n} জন প্রতিবেশী একই সমস্যার কথা জানিয়েছেন।`,
    enterCode: "ট্র্যাকিং আইডি দিন",
    privacy: "কোনো অ্যাকাউন্টের প্রয়োজন নেই। আপনার নাম বা নম্বর কাউকে দেখানো হয় না।",
  }
};
