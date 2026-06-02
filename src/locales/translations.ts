import type { LanguageCode, TranslationMap } from "../i18n";
import { en } from "./en";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";
import { ja } from "./ja";
import { ko } from "./ko";
import { fr } from "./fr";
import { de } from "./de";
import { es } from "./es";
import { pt } from "./pt";

export const translations: Record<LanguageCode, TranslationMap> = {
  en: en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja: ja,
  ko: ko,
  fr: fr,
  de: de,
  es: es,
  pt: pt,
};
