import type { Category, Urgency } from "../categories";

// Parallel phrase bank for synthetic citizen messages. Every phrase exists in each language, so the
// generator always knows the English pivot text for any message. "hl" = Hinglish (Hindi in Latin script).

export type TLang = "en" | "hi" | "hl" | "mr" | "ta" | "te" | "bn";
export type P = Record<Exclude<TLang, "mr" | "ta" | "te" | "bn">, string> & { mr?: string; ta?: string; te?: string; bn?: string };

export type Problem = {
  key: string;
  urgency: Urgency;
  sick?: boolean;
  regions?: string[]; // restrict to these region codes
  p: P;
};

export const PROBLEMS: Record<Category, Problem[]> = {
  water_supply: [
    { key: "no piped water", urgency: "high", p: { en: "There has been no water in the taps", hi: "नलों में पानी नहीं आ रहा है", hl: "nal mein paani nahi aa raha hai", mr: "नळाला पाणी येत नाहीये", ta: "குழாய்களில் தண்ணீர் வரவில்லை", te: "కుళాయిల్లో నీరు రావడం లేదు", bn: "কলে জল আসছে না" } },
    { key: "broken handpump", urgency: "high", regions: ["IN-DL", "IN-MH", "IN-TN"], p: { en: "The handpump has been broken", hi: "हैंडपंप खराब पड़ा है", hl: "handpump kharab pada hai", mr: "हातपंप नादुरुस्त आहे", ta: "கைப்பம்பு பழுதடைந்துள்ளது", te: "చేతిపంపు పాడైపోయింది", bn: "টিউবওয়েল খারাপ হয়ে আছে" } },
    { key: "irregular water tanker", urgency: "medium", regions: ["IN-DL", "IN-MH"], p: { en: "The water tanker has been coming only once a week", hi: "पानी का टैंकर हफ्ते में सिर्फ एक बार आ रहा है", hl: "paani ka tanker hafte mein sirf ek baar aa raha hai", mr: "पाण्याचा टँकर आठवड्यातून एकदाच येतो", ta: "தண்ணீர் லாரி வாரத்திற்கு ஒரு முறை மட்டுமே வருகிறது", te: "వాటర్ ట్యాంకర్ వారానికి ఒకసారే వస్తోంది", bn: "জলের ট্যাঙ্কার সপ্তাহে মাত্র একবার আসে" } },
    { key: "contaminated water", urgency: "critical", sick: true, p: { en: "Dirty, smelly water has been coming from the supply", hi: "नल से गंदा और बदबूदार पानी आ रहा है", hl: "nal se ganda aur badboodar paani aa raha hai", mr: "नळातून घाणेरडं आणि दुर्गंधीयुक्त पाणी येतंय", ta: "குழாயிலிருந்து அசுத்தமான மற்றும் துர்நாற்றம் வீசும் தண்ணீர் வருகிறது", te: "కుళాయి నుంచి మురికి, దుర్వాసనతో కూడిన నీరు వస్తోంది", bn: "কল থেকে নোংরা ও দুর্গন্ধযুক্ত জল আসছে" } },
    { key: "low water pressure", urgency: "medium", p: { en: "Water pressure has been extremely low", hi: "पानी का प्रेशर बहुत कम है", hl: "paani ka pressure bahut kam hai", mr: "पाण्याचा दाब खूपच कमी आहे", ta: "தண்ணீர் அழுத்தம் மிகவும் குறைவாக உள்ளது", te: "నీటి ప్రెజర్ చాలా తక్కువగా ఉంది", bn: "জলের চাপ খুব কম" } },
  ],
  sanitation_drainage: [
    { key: "blocked drain", urgency: "high", sick: true, p: { en: "The drain has been blocked and overflowing", hi: "नाली जाम है और गंदा पानी सड़क पर बह रहा है", hl: "naali jam hai aur ganda paani sadak par beh raha hai", mr: "गटार तुंबली असून सांडपाणी रस्त्यावर वाहत आहे", ta: "சாக்கடை அடைபட்டு அசுத்த நீர் வீதியில் பாய்கிறது", te: "కాలువ పూడికపోయి మురుగునీరు రోడ్డుపై పారుతోంది", bn: "নর্দমা জ্যাম হয়ে রাস্তার উপর নোংরা জল বইছে" } },
    { key: "waterlogging after rain", urgency: "high", p: { en: "The street has been waterlogged after every rain", hi: "हर बारिश के बाद गली में पानी भर जाता है", hl: "har baarish ke baad gali mein paani bhar jaata hai", mr: "प्रत्येक पावसानंतर रस्त्यावर पाणी साचते", ta: "ஒவ்வொரு மழைக்குப் பிறகும் வீதியில் தண்ணீர் தேங்குகிறது", te: "ప్రతి వర్షం తర్వాత వీధిలో నీరు నిలిచిపోతోంది", bn: "বৃষ্টির পরই রাস্তায় জল জমে যায়" } },
    { key: "no public toilet", urgency: "medium", p: { en: "There has been no working public toilet", hi: "कोई चालू सार्वजनिक शौचालय नहीं है", hl: "koi chalu public toilet nahi hai", mr: "चालू स्थितीत एकही सार्वजनिक शौचालय नाही", ta: "பயன்படுத்தக்கூடிய பொது கழிப்பறை எதுவும் இல்லை", te: "పనిచేసే పబ్లిక్ టాయిలెట్ ఒక్కటి కూడా లేదు", bn: "এখানে ব্যবহারযোগ্য কোনো পাবলিক টয়লেট নেই" } },
    { key: "open sewage", urgency: "critical", sick: true, p: { en: "Open sewage has been flowing next to homes", hi: "घरों के पास खुला सीवर बह रहा है", hl: "gharon ke paas khula sewer beh raha hai", mr: "घरांजवळ उघड्यावरून सांडपाणी वाहत आहे", ta: "வீடுகளுக்கு அருகில் திறந்த சாக்கடை ஓடுகிறது", te: "ఇళ్ల పక్కన ఓపెన్ డ్రైనేజీ పారుతోంది", bn: "বাড়ির পাশ দিয়ে খোলা নর্দমা বইছে" } },
  ],
  roads_transport: [
    { key: "potholes", urgency: "medium", p: { en: "The road has been full of deep potholes", hi: "सड़क पर गहरे गड्ढे हैं", hl: "sadak par gehre gaddhe hain", mr: "रस्त्यावर मोठे खड्डे पडले आहेत", ta: "சாலையில் பல ஆழமான குழிகள் உள்ளன", te: "రోడ్డు నిండా పెద్ద గుంతలు పడ్డాయి", bn: "রাস্তায় অনেক বড় বড় গর্ত" } },
    { key: "unsafe bridge", urgency: "critical", p: { en: "The small bridge over the canal has been cracked and unsafe", hi: "नहर पर बनी पुलिया टूटी हुई और खतरनाक है", hl: "nahar wali puliya tooti hui aur khatarnak hai", mr: "कालव्यावरील छोटा पूल खचलेला आणि धोकादायक आहे", ta: "கால்வாயின் மீதான சிறிய பாலம் விரிசல் விட்டு ஆபத்தான நிலையில் உள்ளது", te: "కాలువపై ఉన్న చిన్న వంతెనకు పగుళ్లు వచ్చాయి, ప్రమాదకరంగా ఉంది", bn: "খালের ওপর ছোট সেতুটিতে ফাটল ধরেছে, বিপজ্জনক অবস্থায় আছে" } },
    { key: "no bus service", urgency: "medium", p: { en: "No bus has been stopping here", hi: "यहाँ कोई बस नहीं रुकती", hl: "yahan koi bus nahi rukti", mr: "येथे कोणतीही बस थांबत नाही", ta: "இங்கே எந்த பேருந்தும் நிற்பதில்லை", te: "ఇక్కడ ఏ బస్సూ ఆగడం లేదు", bn: "এখানে কোনো বাস থামে না" } },
    { key: "unpaved road", urgency: "low", p: { en: "The lane has remained unpaved and muddy", hi: "गली अब तक कच्ची और कीचड़ भरी है", hl: "gali ab tak kachchi aur keechad bhari hai", mr: "गल्ली अजूनही कच्ची आणि चिखलमय आहे", ta: "சந்து இன்னும் தார் போடப்படாமல் சகதியாக உள்ளது", te: "సందు ఇంకా మట్టి రోడ్డుగానే ఉంది, బురదగా మారుతోంది", bn: "গলিটা এখনও কাঁচা এবং কাদায় ভর্তি" } },
  ],
  electricity: [
    { key: "long power cuts", urgency: "high", p: { en: "There have been power cuts for many hours every day", hi: "रोज़ कई घंटे बिजली कटती है", hl: "roz kai ghante bijli kat-ti hai", mr: "रोज अनेक तास वीजपुरवठा खंडित असतो", ta: "தினமும் பல மணி நேரம் மின்தடை ஏற்படுகிறது", te: "రోజూ చాలా గంటలు కరెంటు పోతోంది", bn: "রোজ অনেক ঘণ্টা কারেন্ট থাকে না" } },
    { key: "burnt transformer", urgency: "high", p: { en: "The transformer has been burnt out", hi: "ट्रांसफार्मर जल गया है", hl: "transformer jal gaya hai", mr: "ट्रान्सफॉर्मर जळाला आहे", ta: "மின்மாற்றி (டிரான்ஸ்பார்மர்) எரிந்துவிட்டது", te: "ట్రాన్స్‌ఫార్మర్ కాలిపోయింది", bn: "ট্রান্সফরমার পুড়ে গেছে" } },
    { key: "dangling live wires", urgency: "critical", p: { en: "Live wires have been hanging low over the street", hi: "गली में बिजली के नंगे तार नीचे लटक रहे हैं", hl: "gali mein bijli ke nange taar neeche latak rahe hain", mr: "रस्त्यावर उघड्या विजेच्या तारा खाली लोंबत आहेत", ta: "தெருவில் திறந்த மின்கம்பிகள் தாழ்வாக தொங்குகின்றன", te: "వీధిలో కరెంటు వైర్లు కిందకు వేలాడుతున్నాయి", bn: "রাস্তায় খোলা বিদ্যুতের তার ঝুলছে" } },
    { key: "voltage fluctuation", urgency: "medium", p: { en: "Voltage has been fluctuating and damaging appliances", hi: "वोल्टेज ऊपर-नीचे होने से उपकरण खराब हो रहे हैं", hl: "voltage upar-neeche hone se appliances kharab ho rahe hain", mr: "व्होल्टेज कमी-जास्त होत असल्याने उपकरणे खराब होत आहेत", ta: "மின்னழுத்தம் மாறுபடுவதால் மின்சாதனங்கள் பழுதாகின்றன", te: "వోల్టేజ్ హెచ్చుతగ్గుల వల్ల వస్తువులు పాడవుతున్నాయి", bn: "ভোল্টেজ ওঠানামা করায় যন্ত্রপাতি খারাপ হচ্ছে" } },
  ],
  health: [
    { key: "no doctor at clinic", urgency: "high", p: { en: "The local clinic has had no doctor", hi: "मोहल्ला क्लिनिक में डॉक्टर नहीं है", hl: "mohalla clinic mein doctor nahi hai", mr: "स्थानिक दवाखान्यात डॉक्टर उपलब्ध नाही", ta: "உள்ளூர் கிளினிக்கில் மருத்துவர் இல்லை", te: "స్థానిక క్లినిక్‌లో డాక్టర్ లేరు", bn: "স্থানীয় ক্লিনিকে ডাক্তার নেই" } },
    { key: "medicine shortage", urgency: "high", p: { en: "The health centre has run out of basic medicines", hi: "स्वास्थ्य केंद्र में ज़रूरी दवाइयाँ खत्म हैं", hl: "health centre mein zaroori dawaiyan khatam hain", mr: "आरोग्य केंद्रात अत्यावश्यक औषधांचा तुटवडा आहे", ta: "சுகாதார மையத்தில் அடிப்படை மருந்துகள் தீர்ந்துவிட்டன", te: "హెల్త్ సెంటర్‌లో మందుల కొరత ఉంది", bn: "স্বাস্থ্যকেন্দ্রে প্রয়োজনীয় ওষুধ নেই" } },
    { key: "fever outbreak", urgency: "critical", sick: true, p: { en: "Many people have fallen sick with high fever", hi: "बहुत से लोग तेज़ बुखार से बीमार हैं", hl: "bahut log tez bukhar se bimar hain", mr: "अनेक लोक तीव्र तापाने आजारी पडले आहेत", ta: "பலர் அதிக காய்ச்சலால் பாதிக்கப்பட்டுள்ளனர்", te: "చాలామంది తీవ్ర జ్వరంతో అనారోగ్యానికి గురయ్యారు", bn: "অনেকে প্রচণ্ড জ্বরে আক্রান্ত হয়েছেন" } },
    { key: "hospital too far", urgency: "medium", p: { en: "The nearest hospital has been too far to reach", hi: "सबसे नज़दीकी अस्पताल बहुत दूर है", hl: "sabse nazdeeki hospital bahut door hai", mr: "सर्वांत जवळचे रुग्णालय खूप दूर आहे", ta: "அருகிலுள்ள மருத்துவமனை மிகவும் தொலைவில் உள்ளது", te: "దగ్గరి ఆసుపత్రి చాలా దూరంలో ఉంది", bn: "কাছাকাছি হাসপাতাল অনেক দূরে" } },
  ],
  education: [
    { key: "overcrowded school", urgency: "medium", p: { en: "The government school has been badly overcrowded", hi: "सरकारी स्कूल में क्लास में बहुत ज़्यादा बच्चे हैं", hl: "sarkari school mein class mein bahut zyada bachche hain", mr: "शासकीय शाळेत वर्गांमध्ये खूप जास्त विद्यार्थी आहेत", ta: "அரசுப் பள்ளியில் வகுப்பறைகளில் அதிக மாணவர்கள் உள்ளனர்", te: "ప్రభుత్వ పాఠశాలలో తరగతులు కిక్కిరిసిపోయాయి", bn: "সরকারি স্কুলে ক্লাসরুমে প্রচুর ছাত্রছাত্রী" } },
    { key: "teacher shortage", urgency: "high", p: { en: "The school has had no teachers for key subjects", hi: "स्कूल में कई विषयों के शिक्षक नहीं हैं", hl: "school mein kai subjects ke teacher nahi hain", mr: "शाळेत मुख्य विषयांचे शिक्षक नाहीत", ta: "பள்ளியில் முக்கிய பாடங்களுக்கு ஆசிரியர்கள் இல்லை", te: "స్కూల్లో ముఖ్యమైన సబ్జెక్టులకు టీచర్లు లేరు", bn: "স্কুলে প্রয়োজনীয় বিষয়ের শিক্ষক নেই" } },
    { key: "leaking school roof", urgency: "high", p: { en: "The school building roof has been leaking", hi: "स्कूल की छत टपक रही है", hl: "school ki chhat tapak rahi hai", mr: "शाळेच्या इमारतीची छत गळत आहे", ta: "பள்ளிக் கட்டடத்தின் கூரை ஒழுகுகிறது", te: "స్కూల్ భవనం పైకప్పు కురుస్తోంది", bn: "স্কুলের ছাদ চুঁইয়ে জল পড়ে" } },
    { key: "no secondary school nearby", urgency: "medium", p: { en: "There has been no secondary school nearby", hi: "पास में कोई सेकेंडरी स्कूल नहीं है", hl: "paas mein koi secondary school nahi hai", mr: "जवळपास कोणतीही माध्यमिक शाळा नाही", ta: "அருகில் எந்த நடுநிலைப் பள்ளியும் இல்லை", te: "దగ్గరలో హైస్కూల్ లేదు", bn: "কাছাকাছি কোনো মাধ্যমিক স্কুল নেই" } },
  ],
  housing: [
    { key: "leaking homes", urgency: "medium", p: { en: "Our houses have been leaking badly whenever it rains", hi: "बारिश में हमारे घरों की छतें टपकती हैं", hl: "baarish mein hamare gharon ki chhatein tapakti hain", mr: "पावसात आमच्या घरांची छत खूप गळते", ta: "மழை பெய்யும்போதெல்லாம் எங்கள் வீடுகள் ஒழுகுகின்றன", te: "వర్షం పడినప్పుడల్లా మా ఇళ్లు కురుస్తున్నాయి", bn: "বৃষ্টি হলেই আমাদের বাড়ির ছাদ থেকে জল পড়ে" } },
    { key: "eviction threat", urgency: "high", p: { en: "Families have been living under threat of eviction", hi: "परिवारों पर बेदखली का खतरा है", hl: "pariwaron par bedakhli ka khatra hai", mr: "कुटुंबांवर बेघर होण्याची टांगती तलवार आहे", ta: "குடும்பங்கள் வெளியேற்றப்படும் அபாயத்தில் வாழ்கின்றன", te: "కుటుంబాలు ఇళ్లు ఖాళీ చేయాలనే భయంతో బతుకుతున్నాయి", bn: "পরিবারগুলোর ওপর উচ্ছেদের আশঙ্কা ঝুলছে" } },
    { key: "no heating", urgency: "high", regions: ["IN-WB", "IN-TS"], p: { en: "The building has had no heating", hi: "इमारत में हीटिंग नहीं है", hl: "building mein heating nahi hai", mr: "इमारतीत हीटिंग नाहीये", ta: "கட்டடத்தில் வெப்பமூட்டும் வசதி இல்லை", te: "భవనంలో హీటింగ్ లేదు", bn: "বাড়িতে হিটিং নেই" } },
    { key: "dangerous building cracks", urgency: "critical", p: { en: "The old building has developed dangerous cracks", hi: "पुरानी इमारत में खतरनाक दरारें आ गई हैं", hl: "purani building mein khatarnak daraarein aa gayi hain", mr: "जुन्या इमारतीला धोकादायक तडे गेले आहेत", ta: "பழைய கட்டடத்தில் ஆபத்தான விரிசல்கள் ஏற்பட்டுள்ளன", te: "పాత భవనానికి ప్రమాదకరమైన పగుళ్లు వచ్చాయి", bn: "পুরোনো বাড়িটিতে বিপজ্জনক ফাটল দেখা দিয়েছে" } },
  ],
  waste_management: [
    { key: "garbage not collected", urgency: "medium", sick: true, p: { en: "Garbage has not been collected", hi: "कूड़ा नहीं उठाया गया है", hl: "kooda nahi uthaya gaya hai", mr: "कचरा उचलला गेलेला नाही", ta: "குப்பை அள்ளப்படவில்லை", te: "చెత్తను ఎవరూ తీసుకెళ్లలేదు", bn: "ময়লা কেউ নিতে আসেনি" } },
    { key: "illegal dump", urgency: "medium", p: { en: "An open garbage dump has formed", hi: "खुले में कूड़े का ढेर लग गया है", hl: "khule mein kude ka dher lag gaya hai", mr: "उघड्यावर कचऱ्याचा ढीग साचला आहे", ta: "திறந்தவெளியில் குப்பை மலை போல் குவிந்துள்ளது", te: "బహిరంగ ప్రదేశంలో చెత్త కుప్పగా మారింది", bn: "খোলা জায়গায় ময়লার স্তূপ জমেছে" } },
    { key: "garbage burning", urgency: "high", sick: true, p: { en: "People have been burning garbage and the smoke is choking us", hi: "लोग कूड़ा जला रहे हैं और धुएं से सांस लेना मुश्किल है", hl: "log kooda jala rahe hain aur dhuen se saans lena mushkil hai", mr: "लोक कचरा जाळत असून धुरामुळे गुदमरायला होतंय", ta: "மக்கள் குப்பைகளை எரிக்கிறார்கள், புகையால் மூச்சு முட்டுகிறது", te: "జనాలు చెత్త కాలుస్తున్నారు, పొగ వల్ల ఊపిరాడటం లేదు", bn: "মানুষ ময়লা পোড়াচ্ছে, ধোঁয়ায় শ্বাস নিতে কষ্ট হচ্ছে" } },
  ],
  public_safety_lighting: [
    { key: "streetlights out", urgency: "medium", p: { en: "The streetlights have not been working", hi: "स्ट्रीट लाइटें खराब हैं", hl: "street lights kharab hain", mr: "रस्त्यावरील दिवे बंद आहेत", ta: "தெருவிளக்குகள் எரியவில்லை", te: "వీధి దీపాలు వెలగడం లేదు", bn: "রাস্তার আলো জ্বলছে না" } },
    { key: "unsafe at night", urgency: "high", p: { en: "The area has been unsafe for women at night", hi: "रात में महिलाओं के लिए इलाका असुरक्षित है", hl: "raat mein mahilaon ke liye ilaka unsafe hai", mr: "हा भाग रात्री महिलांसाठी असुरक्षित आहे", ta: "இரவில் பெண்களுக்கு இப்பகுதி பாதுகாப்பற்றது", te: "రాత్రి పూట ఈ ప్రాంతం మహిళలకు సురక్షితం కాదు", bn: "রাতে এই এলাকা মহিলাদের জন্য নিরাপদ নয়" } },
    { key: "repeated thefts", urgency: "low", p: { en: "There have been repeated thefts and no CCTV", hi: "बार-बार चोरी हो रही है और कोई सीसीटीवी नहीं है", hl: "baar-baar chori ho rahi hai aur koi CCTV nahi hai", mr: "वारंवार चोऱ्या होत असून सीसीटीव्ही नाही", ta: "தொடர்ந்து திருட்டுகள் நடக்கின்றன, சிசிடிவி இல்லை", te: "వరుస దొంగతనాలు జరుగుతున్నాయి, సీసీటీవీలు లేవు", bn: "বারবার চুরি হচ্ছে, কোনো সিসিটিভি নেই" } },
  ],
  digital_connectivity: [
    { key: "no mobile signal", urgency: "medium", p: { en: "There has been no mobile signal", hi: "मोबाइल नेटवर्क नहीं आता", hl: "mobile network nahi aata", mr: "मोबाईलला नेटवर्क येत नाही", ta: "மொபைல் சிக்னல் இல்லை", te: "మొబైల్ సిగ్నల్ రావడం లేదు", bn: "মোবাইলে কোনো সিগন্যাল নেই" } },
    { key: "no internet for students", urgency: "low", p: { en: "Students have had no internet access for online classes", hi: "बच्चों के पास ऑनलाइन पढ़ाई के लिए इंटरनेट नहीं है", hl: "bachchon ke paas online padhai ke liye internet nahi hai", mr: "विद्यार्थ्यांकडे ऑनलाइन वर्गांसाठी इंटरनेट नाही", ta: "மாணவர்களுக்கு ஆன்லைன் வகுப்புகளுக்கு இணைய வசதி இல்லை", te: "ఆన్‌లైన్ క్లాసుల కోసం విద్యార్థులకు ఇంటర్నెట్ లేదు", bn: "ছাত্রছাত্রীদের অনলাইন ক্লাসের জন্য ইন্টারনেট নেই" } },
    { key: "service centre closed", urgency: "medium", p: { en: "The citizen service centre has been closed", hi: "जन सेवा केंद्र बंद पड़ा है", hl: "jan seva kendra band pada hai", mr: "नागरिक सुविधा केंद्र बंद आहे", ta: "குடிமக்கள் சேவை மையம் மூடப்பட்டுள்ளது", te: "సిటిజన్ సర్వీస్ సెంటర్ మూసివేయబడింది", bn: "নাগরিক পরিষেবা কেন্দ্র বন্ধ রয়েছে" } },
  ],
  agriculture_irrigation: [
    { key: "dry irrigation canal", urgency: "high", p: { en: "The irrigation canal has been dry", hi: "सिंचाई की नहर सूखी पड़ी है", hl: "sinchai ki nahar sookhi padi hai", mr: "सिंचनाचा कालवा कोरडा पडला आहे", ta: "பாசனக் கால்வாய் வறண்டு கிடக்கிறது", te: "సాగునీటి కాలువ ఎండిపోయింది", bn: "সেচের খাল শুকিয়ে গেছে" } },
    { key: "garden without water", urgency: "low", p: { en: "The community garden has had no water connection", hi: "सामुदायिक बगीचे में पानी का कनेक्शन नहीं है", hl: "community garden mein paani ka connection nahi hai", mr: "सार्वजनिक बागेला पाण्याचे कनेक्शन नाही", ta: "பொதுப் பூங்காவில் தண்ணீர் வசதி இல்லை", te: "పబ్లిక్ గార్డెన్‌కు నీటి సదుపాయం లేదు", bn: "পাবলিক পার্কে জলের কোনো সংযোগ নেই" } },
  ],
  other: [
    { key: "stray animals", urgency: "low", p: { en: "Stray dogs have been attacking people", hi: "आवारा कुत्ते लोगों पर हमला कर रहे हैं", hl: "aawara kutte logon par hamla kar rahe hain", mr: "मोकाट कुत्रे लोकांवर हल्ला करत आहेत", ta: "தெருநாய்கள் மக்களைத் தாக்குகின்றன", te: "వీధి కుక్కలు జనాలపై దాడి చేస్తున్నాయి", bn: "রাস্তার কুকুর মানুষকে তাড়া করছে" } },
    { key: "noise pollution", urgency: "low", p: { en: "Loud noise from a factory has continued day and night", hi: "फैक्ट्री का शोर दिन-रात चलता है", hl: "factory ka shor din-raat chalta hai", mr: "कारखान्याचा गोंगाट रात्रंदिवस सुरू असतो", ta: "தொழிற்சாலையின் சத்தம் இரவு பகலாக தொடர்கிறது", te: "ఫ్యాక్టరీ చప్పుడు రాత్రింబవళ్లు వస్తోంది", bn: "কারখানার শব্দ দিনরাত ধরে চলছে" } },
  ],
};

export const LANDMARKS: P[] = [
  { en: "near the government school", hi: "सरकारी स्कूल के पास", hl: "sarkari school ke paas", mr: "शासकीय शाळेजवळ", ta: "அரசுப் பள்ளி அருகில்", te: "ప్రభుత్వ పాఠశాల దగ్గర", bn: "সরকারি স্কুলের কাছে" },
  { en: "near the main market", hi: "मेन मार्केट के पास", hl: "main market ke paas", mr: "मुख्य बाजारपेठेजवळ", ta: "முக்கிய சந்தை அருகில்", te: "మెయిన్ మార్కెట్ దగ్గర", bn: "মূল বাজারের কাছে" },
  { en: "by the bus stop", hi: "बस स्टॉप के पास", hl: "bus stop ke paas", mr: "बस स्टॉपजवळ", ta: "பேருந்து நிறுத்தம் அருகில்", te: "బస్ స్టాప్ దగ్గర", bn: "বাস স্টপের কাছে" },
  { en: "near the community hall", hi: "सामुदायिक भवन के पास", hl: "community hall ke paas", mr: "समाजमंदिराजवळ", ta: "சமுதாயக் கூடம் அருகில்", te: "కమ్యూనిటీ హాల్ దగ్గర", bn: "কমিউনিটি হলের কাছে" },
  { en: "near the health centre", hi: "डिस्पेंसरी के पास", hl: "dispensary ke paas", mr: "दवाखान्यासारख्या जवळ", ta: "சுகாதார மையம் அருகில்", te: "హెల్త్ సెంటర్ దగ్గర", bn: "স্বাস্থ্যকেন্দ্রের কাছে" },
  { en: "next to the park", hi: "पार्क के पास", hl: "park ke paas", mr: "बागेजवळ", ta: "பூங்கா அருகில்", te: "పార్క్ పక్కన", bn: "পার্কের পাশে" },
  { en: "in Block C", hi: "सी ब्लॉक में", hl: "C block mein", mr: "सी ब्लॉकमध्ये", ta: "சி பிளாக்கில்", te: "సీ బ్లాక్‌లో", bn: "সি ব্লকে" },
];

export const IMPACTS: P[] = [
  { en: "Hundreds of families are affected.", hi: "सैकड़ों परिवार परेशान हैं।", hl: "Sainkdon parivaar pareshaan hain.", mr: "शेकडो कुटुंबे त्रस्त आहेत.", ta: "நூற்றுக்கணக்கான குடும்பங்கள் பாதிக்கப்பட்டுள்ளன.", te: "వందలాది కుటుంబాలు ఇబ్బంది పడుతున్నాయి.", bn: "শত শত পরিবার ক্ষতিগ্রস্ত।" },
  { en: "Children and old people suffer the most.", hi: "बच्चे और बुज़ुर्ग सबसे ज़्यादा परेशान हैं।", hl: "Bachche aur buzurg sabse zyada pareshaan hain.", mr: "मुले आणि वृद्धांना सर्वाधिक त्रास होत आहे.", ta: "குழந்தைகளும் முதியவர்களும் அதிகம் அவதிப்படுகின்றனர்.", te: "పిల్లలు, వృద్ధులు ఎక్కువగా ఇబ్బంది పడుతున్నారు.", bn: "বাচ্চা এবং বয়স্কদের সবচেয়ে বেশি কষ্ট হচ্ছে।" },
  { en: "We have complained many times but nothing happened.", hi: "कई बार शिकायत की पर कुछ नहीं हुआ।", hl: "Kai baar complaint ki par kuch nahi hua.", mr: "अनेकदा तक्रार करूनही काहीच झाले नाही.", ta: "பலமுறை புகார் அளித்தும் எந்த நடவடிக்கையும் இல்லை.", te: "చాలాసార్లు ఫిర్యాదు చేసినా పట్టించుకోలేదు.", bn: "অনেকবার অভিযোগ করেছি কিন্তু কিছু হয়নি।" },
  { en: "Daily life has become very difficult.", hi: "रोज़ की ज़िंदगी बहुत मुश्किल हो गई है।", hl: "Roz ki zindagi bahut mushkil ho gayi hai.", mr: "दैनंदिन जीवन खूपच कठीण झाले आहे.", ta: "அன்றாட வாழ்க்கை மிகவும் கடினமாகிவிட்டது.", te: "రోజువారీ జీవితం చాలా కష్టంగా మారింది.", bn: "দৈনন্দিন জীবন খুব কঠিন হয়ে উঠেছে।" },
];

export const SICK_IMPACT: P = { en: "Children are falling sick.", hi: "बच्चे बीमार पड़ रहे हैं।", hl: "Bachche bimar pad rahe hain.", mr: "मुले आजारी पडत आहेत.", ta: "குழந்தைகள் நோய்வாய்ப்படுகின்றனர்.", te: "పిల్లలు అనారోగ్యం పాలవుతున్నారు.", bn: "বাচ্চারা অসুস্থ হয়ে পড়ছে।" };

export const OPENERS: Record<TLang, string[]> = {
  en: ["", "", "Sir/Madam, ", "Please help. ", "Respected officer, "],
  hi: ["", "", "महोदय, ", "कृपया मदद करें। ", "नमस्ते, "],
  hl: ["", "", "Sir, ", "Please help karo. ", "Namaste, "],
  mr: ["", "", "महोदय, ", "कृपया मदत करा. ", "नमस्कार, "],
  ta: ["", "", "ஐயா/அம்மா, ", "தயவுசெய்து உதவுங்கள். ", "வணக்கம், "],
  te: ["", "", "అయ్యా/అమ్మా, ", "దయచేసి సహాయం చేయండి. ", "నమస్కారం, "],
  bn: ["", "", "মহাশয়/মহাশয়া, ", "দয়া করে সাহায্য করুন। ", "নমস্কার, "],
};

export const CLOSERS: Record<TLang, string[]> = {
  en: ["", "Please fix it soon.", "Kindly take action urgently."],
  hi: ["", "जल्दी ठीक करवाइए।", "कृपया तुरंत कार्रवाई करें।"],
  hl: ["", "Jaldi theek karwao.", "Please jaldi action lo."],
  mr: ["", "लवकर दुरुस्त करा.", "कृपया तातडीने कारवाई करा."],
  ta: ["", "விரைவில் சரிசெய்யவும்.", "தயவுசெய்து உடனடியாக நடவடிக்கை எடுக்கவும்."],
  te: ["", "త్వరగా పరిష్కరించండి.", "దయచేసి వెంటనే చర్యలు తీసుకోండి."],
  bn: ["", "শীঘ্রই ঠিক করুন।", "দয়া করে দ্রুত ব্যবস্থা নিন।"],
};

export const SPAM: Partial<Record<TLang, string[]>> = {
  en: ["Earn money from home daily, click this link now", "Happy festival to everyone!", "Who will win the match tonight?"],
  hi: ["सबको त्योहार की शुभकामनाएं", "घर बैठे पैसे कमाएं, अभी लिंक पर क्लिक करें"],
  hl: ["Sabko happy festival!", "Ghar baithe paise kamao, link pe click karo"],
  mr: ["सर्वांना सणांच्या शुभेच्छा", "घरी बसून पैसे कमवा, आता या लिंकवर क्लिक करा"],
  ta: ["அனைவருக்கும் பண்டிகை வாழ்த்துக்கள்", "வீட்டிலிருந்தபடியே பணம் சம்பாதிக்க, இப்போதே இந்த இணைப்பை கிளிக் செய்யவும்"],
  te: ["అందరికీ పండుగ శుభాకాంక్షలు", "ఇంటి నుంచే డబ్బు సంపాదించండి, ఈ లింక్ క్లిక్ చేయండి"],
  bn: ["সবাইকে উৎসবের শুভেচ্ছা", "ঘরে বসে টাকা আয় করুন, এই লিঙ্কে ক্লিক করুন"],
};

export const NON_ACTIONABLE: P = {
  en: "The government never does anything for us.",
  hi: "सरकार हमारे लिए कुछ नहीं करती।",
  hl: "Sarkar hamare liye kuch nahi karti.",
  mr: "सरकार आमच्यासाठी कधीच काही करत नाही.",
  ta: "அரசு எங்களுக்காக எதையும் செய்வதில்லை.",
  te: "ప్రభుత్వం మాకోసం ఏమీ చేయడం లేదు.",
  bn: "সরকার আমাদের জন্য কিছুই করে না.",
};

type Unit = "day" | "week" | "month";

export function duration(lang: TLang, n: number, unit: Unit): string {
  switch (lang) {
    case "en":
      return `for ${n} ${unit}${n === 1 ? "" : "s"}`;
    case "hi":
      return `पिछले ${n} ${{ day: "दिनों", week: "हफ़्तों", month: "महीनों" }[unit]} से`;
    case "hl":
      return `pichhle ${n} ${{ day: "dinon", week: "hafton", month: "mahinon" }[unit]} se`;
    case "mr":
      return `गेल्या ${n} ${{ day: n === 1 ? "दिवसापासून" : "दिवसांपासून", week: n === 1 ? "आठवड्यापासून" : "आठवड्यांपासून", month: n === 1 ? "महिन्यापासून" : "महिन्यांपासून" }[unit]}`;
    case "ta":
      return `கடந்த ${n} ${{ day: "நாட்களாக", week: "வாரங்களாக", month: "மாதங்களாக" }[unit]}`;
    case "te":
      return `గత ${n} ${{ day: "రోజులుగా", week: "వారాలుగా", month: "నెలలుగా" }[unit]}`;
    case "bn":
      return `গত ${n} ${{ day: "দিন ধরে", week: "সপ্তাহ ধরে", month: "মাস ধরে" }[unit]}`;
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
    case "mr":
      return lm ? `${locality} मध्ये ${lm}` : `${locality} मध्ये`;
    case "ta":
      return lm ? `${locality} இல் ${lm}` : `${locality} இல்`;
    case "te":
      return lm ? `${locality} లో ${lm}` : `${locality} లో`;
    case "bn":
      return lm ? `${locality} তে ${lm}` : `${locality} তে`;
  }
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/\s+([.,।。，!])/g, "$1").replace(/,\./g, ".").trim();

/** Assemble one sentence in the language's natural word order. */
export function assemble(
  lang: TLang,
  parts: { opener: string; problem: string; loc: string; dur: string; impact: string; closer: string },
): string {
  const { opener, problem, loc, dur, impact, closer } = parts;
  switch (lang) {
    case "en": {
      // After "Sir/Madam," the sentence continues in lower case; after "Please help." it starts anew.
      const head = opener.trim().endsWith(",") ? problem[0].toLowerCase() + problem.slice(1) : cap(problem);
      return tidy(`${opener}${head} ${loc} ${dur}. ${impact} ${closer}`);
    }
    case "hi":
      return tidy(`${opener}${loc} ${dur} ${problem}। ${impact} ${closer}`);
    case "hl":
      return tidy(`${opener}${cap(`${loc} ${dur} ${problem}`.trim())}. ${impact} ${closer}`);
    case "mr":
      return tidy(`${opener}${loc} ${dur} ${problem}। ${impact} ${closer}`);
    case "ta":
      return tidy(`${opener}${loc} ${dur} ${problem}. ${impact} ${closer}`);
    case "te":
      return tidy(`${opener}${loc} ${dur} ${problem}. ${impact} ${closer}`);
    case "bn":
      return tidy(`${opener}${loc} ${dur} ${problem}। ${impact} ${closer}`);
  }
}
