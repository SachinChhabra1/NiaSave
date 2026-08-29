export const languageOptions = [
  { id: "en", code: "EN", label: "English" },
  { id: "hi", code: "HI", label: "हिंदी" },
  { id: "kn", code: "KN", label: "ಕನ್ನಡ" },
  { id: "ta", code: "TA", label: "தமிழ்" }
];

const shared = {
  en: {
    nav: { work: "Earn", nest: "Live", save: "Save", home: "Send" },
    deliveredTo: "Delivered to your Studio", weeklySavings: "Weekly Savings", savedOf: "saved of",
    fever: "Bag ₹500 this month → fever day free.", search: "Search salt, oil, Maggi",
    categories: ["All", "Staples", "Oils", "Meals", "Rice"], daily: "Daily essentials", seeAll: "See all",
    checked: "Kirana price checked", saveWord: "Save", add: "Add", out: "Out",
    noPack: "No pack found. Try salt, oil, or Maggi.", bag: "Bag", atKirana: "at kirana",
    priced: "Priced for your week", proofA: "Checked against the local kirana price. You keep", proofB: "on this pack.",
    addToBag: "Add to bag", yourBag: "Your bag", emptyBag: "Your bag is empty", shop: "Shop", total: "Total",
    bagRoute: "Phone → UPI → Studio", continuePhone: "Continue to phone", phone: "Phone",
    phoneQuestion: "Which phone is with Nia?", phonePlaceholder: "10-digit phone", wrongPhone: "This phone is not with Nia.",
    phoneError: "Could not check this phone. Try again.", checking: "Checking…", continue: "Continue",
    yourStudio: "Your Studio", isThisYou: "This is you?", continueUpi: "Continue to UPI", upi: "UPI",
    pay: "Pay", prepaid: "Prepaid · no cash", payError: "Payment did not go through. Try again.", paying: "Paying…",
    hubBag: "Hub has your bag.", deliveredAt: "Delivered to your Studio at 5:15 PM.", done: "Done",
    language: "Language", close: "Close",
    workTitle: "Earn", warehousePicker: "Warehouse picker", thisWeek: "This week", friday: "Friday", noCut: "no cut", today: "Today", bus: "Bus", help: "Help",
    extra: "Extra", tonightStudio: "Tonight 6–8 PM · Studio", keep: "keep", to: "To", take: "Take", no: "No", extraTaken: "Extra shift taken", extraPassed: "Extra shift passed", choiceError: "Could not save your choice. Try again.", days: "days", pickerPlus: "picker+",
    liveTitle: "Live", yourNest: "Your Nest", bed: "Bed", included: "Included", electricity: "Electricity", water: "Water", cleaning: "Cleaning", wifi: "Wi-Fi", coming: "Coming", imComing: "I’m coming", laundry: "Laundry", back6: "back 6 PM", trim: "Trim", somethingWrong: "Something wrong", satish: "Satish is on it · by 9 PM.",
    sendTitle: "Send", canReach: "can reach Maa.", noFee: "No fee.", sendHome: "Send home", railMissing: "Send-home rail is not configured yet.", sendError: "Could not start send home. Try again.", roof: "Roof", recharge: "Recharge", familySafety: "Family safety", familyContact: "Maa is your family contact."
  },
  hi: {
    nav: { work: "कमाई", nest: "रहना", save: "बचत", home: "भेजें" },
    deliveredTo: "आपके स्टूडियो में डिलीवरी", weeklySavings: "साप्ताहिक बचत", savedOf: "में से बचाए",
    fever: "इस महीने ₹500 का बैग → बुखार वाला दिन मुफ़्त।", search: "नमक, तेल, मैगी खोजें",
    categories: ["सभी", "राशन", "तेल", "झटपट", "चावल"], daily: "रोज़मर्रा की ज़रूरतें", seeAll: "सभी देखें",
    checked: "किराना भाव जाँचा", saveWord: "बचत", add: "जोड़ें", out: "खत्म",
    noPack: "कोई पैक नहीं मिला। नमक, तेल या मैगी खोजें।", bag: "बैग", atKirana: "किराना में",
    priced: "आपके हफ़्ते के लिए सही भाव", proofA: "स्थानीय किराना भाव से जाँचा। आप", proofB: "इस पैक पर बचाते हैं।",
    addToBag: "बैग में जोड़ें", yourBag: "आपका बैग", emptyBag: "आपका बैग खाली है", shop: "खरीदें", total: "कुल",
    bagRoute: "फ़ोन → UPI → स्टूडियो", continuePhone: "फ़ोन से आगे बढ़ें", phone: "फ़ोन",
    phoneQuestion: "Nia के साथ कौन-सा फ़ोन है?", phonePlaceholder: "10 अंकों का फ़ोन", wrongPhone: "यह फ़ोन Nia के साथ नहीं है।",
    phoneError: "फ़ोन जाँच नहीं पाए। फिर कोशिश करें।", checking: "जाँच रहे हैं…", continue: "आगे बढ़ें",
    yourStudio: "आपका स्टूडियो", isThisYou: "क्या यह आप हैं?", continueUpi: "UPI पर जाएँ", upi: "UPI",
    pay: "भुगतान करें", prepaid: "प्रीपेड · नकद नहीं", payError: "भुगतान नहीं हुआ। फिर कोशिश करें।", paying: "भुगतान हो रहा है…",
    hubBag: "हब के पास आपका बैग है।", deliveredAt: "शाम 5:15 बजे आपके स्टूडियो में डिलीवरी।", done: "हो गया",
    language: "भाषा", close: "बंद करें",
    workTitle: "कमाई", warehousePicker: "वेयरहाउस पिकर", thisWeek: "इस हफ़्ते", friday: "शुक्रवार", noCut: "कोई कटौती नहीं", today: "आज", bus: "बस", help: "मदद",
    extra: "अतिरिक्त", tonightStudio: "आज रात 6–8 · स्टूडियो", keep: "रखें", to: "कुल", take: "लें", no: "नहीं", extraTaken: "अतिरिक्त शिफ़्ट ली", extraPassed: "अतिरिक्त शिफ़्ट छोड़ी", choiceError: "चुनाव सेव नहीं हुआ। फिर कोशिश करें।", days: "दिन", pickerPlus: "पिकर+",
    liveTitle: "रहना", yourNest: "आपका नेस्ट", bed: "बेड", included: "शामिल", electricity: "बिजली", water: "पानी", cleaning: "सफ़ाई", wifi: "वाई-फ़ाई", coming: "आ रहा हूँ", imComing: "मैं आऊँगा", laundry: "लॉन्ड्री", back6: "शाम 6 बजे वापस", trim: "ट्रिम", somethingWrong: "कोई परेशानी", satish: "सतीश देख रहे हैं · रात 9 बजे तक।",
    sendTitle: "भेजें", canReach: "माँ तक पहुँच सकते हैं।", noFee: "कोई शुल्क नहीं।", sendHome: "घर भेजें", railMissing: "घर भेजने की सुविधा अभी तैयार नहीं है।", sendError: "घर भेजना शुरू नहीं हुआ। फिर कोशिश करें।", roof: "छत", recharge: "रीचार्ज", familySafety: "परिवार की सुरक्षा", familyContact: "माँ आपका पारिवारिक संपर्क हैं।"
  },
  kn: {
    nav: { work: "ಗಳಿಕೆ", nest: "ವಾಸ", save: "ಉಳಿತಾಯ", home: "ಕಳುಹಿಸಿ" },
    deliveredTo: "ನಿಮ್ಮ ಸ್ಟುಡಿಯೋಗೆ ವಿತರಣೆ", weeklySavings: "ವಾರದ ಉಳಿತಾಯ", savedOf: "ರಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ",
    fever: "ಈ ತಿಂಗಳು ₹500 ಬ್ಯಾಗ್ → ಜ್ವರದ ದಿನ ಉಚಿತ.", search: "ಉಪ್ಪು, ಎಣ್ಣೆ, ಮ್ಯಾಗಿ ಹುಡುಕಿ",
    categories: ["ಎಲ್ಲ", "ದಿನಸಿ", "ಎಣ್ಣೆ", "ತ್ವರಿತ", "ಅಕ್ಕಿ"], daily: "ದಿನಬಳಕೆಯ ಅಗತ್ಯಗಳು", seeAll: "ಎಲ್ಲವನ್ನೂ ನೋಡಿ",
    checked: "ಕಿರಾಣಿ ಬೆಲೆ ಪರಿಶೀಲಿಸಲಾಗಿದೆ", saveWord: "ಉಳಿತಾಯ", add: "ಸೇರಿಸಿ", out: "ಮುಗಿದಿದೆ",
    noPack: "ಪ್ಯಾಕ್ ಸಿಗಲಿಲ್ಲ. ಉಪ್ಪು, ಎಣ್ಣೆ ಅಥವಾ ಮ್ಯಾಗಿ ಹುಡುಕಿ.", bag: "ಬ್ಯಾಗ್", atKirana: "ಕಿರಾಣಿಯಲ್ಲಿ",
    priced: "ನಿಮ್ಮ ವಾರಕ್ಕೆ ಸರಿಯಾದ ಬೆಲೆ", proofA: "ಸ್ಥಳೀಯ ಕಿರಾಣಿ ಬೆಲೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ನೀವು", proofB: "ಈ ಪ್ಯಾಕ್‌ನಲ್ಲಿ ಉಳಿಸುತ್ತೀರಿ.",
    addToBag: "ಬ್ಯಾಗ್‌ಗೆ ಸೇರಿಸಿ", yourBag: "ನಿಮ್ಮ ಬ್ಯಾಗ್", emptyBag: "ನಿಮ್ಮ ಬ್ಯಾಗ್ ಖಾಲಿಯಾಗಿದೆ", shop: "ಖರೀದಿ", total: "ಒಟ್ಟು",
    bagRoute: "ಫೋನ್ → UPI → ಸ್ಟುಡಿಯೋ", continuePhone: "ಫೋನ್‌ನೊಂದಿಗೆ ಮುಂದುವರಿಸಿ", phone: "ಫೋನ್",
    phoneQuestion: "Nia ಜೊತೆ ಯಾವ ಫೋನ್ ಇದೆ?", phonePlaceholder: "10 ಅಂಕಿಯ ಫೋನ್", wrongPhone: "ಈ ಫೋನ್ Nia ಜೊತೆ ಇಲ್ಲ.",
    phoneError: "ಫೋನ್ ಪರಿಶೀಲಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", checking: "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…", continue: "ಮುಂದುವರಿಸಿ",
    yourStudio: "ನಿಮ್ಮ ಸ್ಟುಡಿಯೋ", isThisYou: "ಇದು ನೀವೇ?", continueUpi: "UPIಗೆ ಮುಂದುವರಿಸಿ", upi: "UPI",
    pay: "ಪಾವತಿಸಿ", prepaid: "ಪ್ರೀಪೇಯ್ಡ್ · ನಗದು ಇಲ್ಲ", payError: "ಪಾವತಿ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", paying: "ಪಾವತಿಸಲಾಗುತ್ತಿದೆ…",
    hubBag: "ಹಬ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಬ್ಯಾಗ್ ಇದೆ.", deliveredAt: "ಸಂಜೆ 5:15ಕ್ಕೆ ನಿಮ್ಮ ಸ್ಟುಡಿಯೋಗೆ ವಿತರಣೆ.", done: "ಮುಗಿಯಿತು",
    language: "ಭಾಷೆ", close: "ಮುಚ್ಚಿ",
    workTitle: "ಗಳಿಕೆ", warehousePicker: "ವೇರ್‌ಹೌಸ್ ಪಿಕರ್", thisWeek: "ಈ ವಾರ", friday: "ಶುಕ್ರವಾರ", noCut: "ಕಡಿತ ಇಲ್ಲ", today: "ಇಂದು", bus: "ಬಸ್", help: "ಸಹಾಯ",
    extra: "ಹೆಚ್ಚುವರಿ", tonightStudio: "ಇಂದು ರಾತ್ರಿ 6–8 · ಸ್ಟುಡಿಯೋ", keep: "ಉಳಿಸಿ", to: "ಒಟ್ಟು", take: "ತೆಗೆದುಕೊಳ್ಳಿ", no: "ಬೇಡ", extraTaken: "ಹೆಚ್ಚುವರಿ ಶಿಫ್ಟ್ ತೆಗೆದುಕೊಂಡಿರಿ", extraPassed: "ಹೆಚ್ಚುವರಿ ಶಿಫ್ಟ್ ಬಿಟ್ಟಿರಿ", choiceError: "ಆಯ್ಕೆ ಉಳಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", days: "ದಿನಗಳು", pickerPlus: "ಪಿಕರ್+",
    liveTitle: "ವಾಸ", yourNest: "ನಿಮ್ಮ ನೆಸ್ಟ್", bed: "ಬೆಡ್", included: "ಒಳಗೊಂಡಿದೆ", electricity: "ವಿದ್ಯುತ್", water: "ನೀರು", cleaning: "ಸ್ವಚ್ಛತೆ", wifi: "ವೈ-ಫೈ", coming: "ಬರುತ್ತಿದ್ದೇನೆ", imComing: "ನಾನು ಬರುತ್ತೇನೆ", laundry: "ಲಾಂಡ್ರಿ", back6: "ಸಂಜೆ 6ಕ್ಕೆ ವಾಪಸ್", trim: "ಟ್ರಿಮ್", somethingWrong: "ಏನಾದರೂ ಸಮಸ್ಯೆ", satish: "ಸತೀಶ್ ನೋಡಿಕೊಳ್ಳುತ್ತಿದ್ದಾರೆ · ರಾತ್ರಿ 9ರೊಳಗೆ.",
    sendTitle: "ಕಳುಹಿಸಿ", canReach: "ಅಮ್ಮನಿಗೆ ತಲುಪಬಹುದು.", noFee: "ಶುಲ್ಕ ಇಲ್ಲ.", sendHome: "ಮನೆಗೆ ಕಳುಹಿಸಿ", railMissing: "ಮನೆಗೆ ಕಳುಹಿಸುವ ವ್ಯವಸ್ಥೆ ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ.", sendError: "ಮನೆಗೆ ಕಳುಹಿಸಲು ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", roof: "ಛಾವಣಿ", recharge: "ರೀಚಾರ್ಜ್", familySafety: "ಕುಟುಂಬ ಸುರಕ್ಷತೆ", familyContact: "ಅಮ್ಮ ನಿಮ್ಮ ಕುಟುಂಬ ಸಂಪರ್ಕವಾಗಿದ್ದಾರೆ."
  },
  ta: {
    nav: { work: "சம்பாதி", nest: "வசிப்பு", save: "சேமி", home: "அனுப்பு" },
    deliveredTo: "உங்கள் ஸ்டுடியோவிற்கு விநியோகம்", weeklySavings: "வார சேமிப்பு", savedOf: "இல் சேமித்தது",
    fever: "இந்த மாதம் ₹500 பை → காய்ச்சல் நாளில் இலவசம்.", search: "உப்பு, எண்ணெய், மேகி தேடுங்கள்",
    categories: ["அனைத்தும்", "மளிகை", "எண்ணெய்", "உடனடி", "அரிசி"], daily: "தினசரி தேவைகள்", seeAll: "அனைத்தையும் காண்க",
    checked: "கிரானா விலை சரிபார்க்கப்பட்டது", saveWord: "சேமிப்பு", add: "சேர்", out: "தீர்ந்தது",
    noPack: "பொருள் கிடைக்கவில்லை. உப்பு, எண்ணெய் அல்லது மேகி தேடுங்கள்.", bag: "பை", atKirana: "கிரானாவில்",
    priced: "உங்கள் வாரத்திற்கான சரியான விலை", proofA: "உள்ளூர் கிரானா விலையுடன் சரிபார்க்கப்பட்டது. நீங்கள்", proofB: "இந்தப் பொருளில் சேமிக்கிறீர்கள்.",
    addToBag: "பையில் சேர்", yourBag: "உங்கள் பை", emptyBag: "உங்கள் பை காலியாக உள்ளது", shop: "வாங்குங்கள்", total: "மொத்தம்",
    bagRoute: "தொலைபேசி → UPI → ஸ்டுடியோ", continuePhone: "தொலைபேசியுடன் தொடர்க", phone: "தொலைபேசி",
    phoneQuestion: "Nia உடன் எந்த தொலைபேசி உள்ளது?", phonePlaceholder: "10 இலக்க தொலைபேசி", wrongPhone: "இந்த தொலைபேசி Nia உடன் இல்லை.",
    phoneError: "தொலைபேசியைச் சரிபார்க்க முடியவில்லை. மீண்டும் முயலுங்கள்.", checking: "சரிபார்க்கிறது…", continue: "தொடர்க",
    yourStudio: "உங்கள் ஸ்டுடியோ", isThisYou: "இது நீங்களா?", continueUpi: "UPIக்குத் தொடர்க", upi: "UPI",
    pay: "செலுத்து", prepaid: "முன்பணம் · பணம் இல்லை", payError: "பணம் செலுத்த முடியவில்லை. மீண்டும் முயலுங்கள்.", paying: "செலுத்துகிறது…",
    hubBag: "ஹப்பில் உங்கள் பை உள்ளது.", deliveredAt: "மாலை 5:15க்கு உங்கள் ஸ்டுடியோவில் விநியோகம்.", done: "முடிந்தது",
    language: "மொழி", close: "மூடு",
    workTitle: "சம்பாதி", warehousePicker: "கிடங்கு பிக்கர்", thisWeek: "இந்த வாரம்", friday: "வெள்ளி", noCut: "பிடித்தம் இல்லை", today: "இன்று", bus: "பஸ்", help: "உதவி",
    extra: "கூடுதல்", tonightStudio: "இன்று இரவு 6–8 · ஸ்டுடியோ", keep: "வைத்துக்கொள்", to: "மொத்தம்", take: "எடு", no: "வேண்டாம்", extraTaken: "கூடுதல் ஷிப்ட் எடுக்கப்பட்டது", extraPassed: "கூடுதல் ஷிப்ட் தவிர்க்கப்பட்டது", choiceError: "தேர்வைச் சேமிக்க முடியவில்லை. மீண்டும் முயலுங்கள்.", days: "நாட்கள்", pickerPlus: "பிக்கர்+",
    liveTitle: "வசிப்பு", yourNest: "உங்கள் நெஸ்ட்", bed: "படுக்கை", included: "உள்ளடக்கம்", electricity: "மின்சாரம்", water: "தண்ணீர்", cleaning: "சுத்தம்", wifi: "வை-ஃபை", coming: "வருகிறேன்", imComing: "நான் வருகிறேன்", laundry: "சலவை", back6: "மாலை 6க்கு திரும்பும்", trim: "முடி திருத்தம்", somethingWrong: "ஏதாவது பிரச்சினை", satish: "சதீஷ் கவனிக்கிறார் · இரவு 9க்குள்.",
    sendTitle: "அனுப்பு", canReach: "அம்மாவைச் சென்றடையும்.", noFee: "கட்டணம் இல்லை.", sendHome: "வீட்டுக்கு அனுப்பு", railMissing: "வீட்டுக்கு அனுப்பும் வசதி இன்னும் தயாராகவில்லை.", sendError: "வீட்டுக்கு அனுப்ப முடியவில்லை. மீண்டும் முயலுங்கள்.", roof: "கூரை", recharge: "ரீசார்ஜ்", familySafety: "குடும்ப பாதுகாப்பு", familyContact: "அம்மா உங்கள் குடும்பத் தொடர்பு."
  }
};

export function getCopy(language) {
  return shared[language] || shared.en;
}
