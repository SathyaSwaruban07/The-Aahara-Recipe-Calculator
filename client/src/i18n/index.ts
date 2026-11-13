import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { readLang, writeLang } from "../lib/prefs";
import en from "./locales/en.json";
import ta from "./locales/ta.json";
import hi from "./locales/hi.json";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta },
    hi: { translation: hi },
  },
  lng: readLang("en"),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  writeLang(lng);
});

export default i18n;
