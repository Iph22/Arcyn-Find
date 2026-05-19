"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

// ---------------------------------------------------------------------------
// Supported languages
// ---------------------------------------------------------------------------

export type SupportedLanguage = "en" | "fr" | "es" | "de" | "pt" | "ja" | "zh" | "th" | "tl" | "ko" | "ar" | "hi" | "tr" | "vi" | "id"

export interface LanguageOption {
  code: SupportedLanguage
  label: string
  flag: string
  nativeLabel: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English",     flag: "🇬🇧", nativeLabel: "English"     },
  { code: "fr", label: "French",      flag: "🇫🇷", nativeLabel: "Français"    },
  { code: "es", label: "Spanish",     flag: "🇪🇸", nativeLabel: "Español"     },
  { code: "de", label: "German",      flag: "🇩🇪", nativeLabel: "Deutsch"     },
  { code: "pt", label: "Portuguese",  flag: "🇧🇷", nativeLabel: "Português"   },
  { code: "ja", label: "Japanese",    flag: "🇯🇵", nativeLabel: "日本語"       },
  { code: "zh", label: "Chinese",     flag: "🇨🇳", nativeLabel: "中文"         },
  { code: "ko", label: "Korean",      flag: "🇰🇷", nativeLabel: "한국어"       },
  { code: "th", label: "Thai",        flag: "🇹🇭", nativeLabel: "ภาษาไทย"     },
  { code: "tl", label: "Filipino",    flag: "🇵🇭", nativeLabel: "Filipino"    },
  { code: "vi", label: "Vietnamese",  flag: "🇻🇳", nativeLabel: "Tiếng Việt"  },
  { code: "id", label: "Indonesian",  flag: "🇮🇩", nativeLabel: "Bahasa"      },
  { code: "hi", label: "Hindi",       flag: "🇮🇳", nativeLabel: "हिन्दी"        },
  { code: "ar", label: "Arabic",      flag: "🇸🇦", nativeLabel: "العربية"      },
  { code: "tr", label: "Turkish",     flag: "🇹🇷", nativeLabel: "Türkçe"      },
]

// ---------------------------------------------------------------------------
// Translation dictionary
// ---------------------------------------------------------------------------

type TranslationKey =
  | "nav.home"
  | "nav.tools"
  | "nav.collections"
  | "nav.profile"
  | "nav.settings"
  | "nav.reviews"
  | "nav.signIn"
  | "nav.signOut"
  | "nav.getStarted"
  | "search.placeholder"
  | "search.filters"
  | "search.pricingModel"
  | "search.region"
  | "search.selectRegion"
  | "search.anyPrice"
  | "search.reset"
  | "search.noToolsFound"
  | "search.tryAdjusting"
  | "search.loadMore"
  | "search.showing"
  | "search.personalized"
  | "tools.featured"
  | "tools.details"
  | "tools.addToFavorites"
  | "tools.removeFromFavorites"
  | "tools.signInToSave"
  | "tools.category.all"
  | "common.loading"
  | "common.retry"
  | "common.language"
  | "regions.global"
  | "regions.usa"
  | "regions.europe"
  | "regions.asia"
  | "regions.asiaPacific"
  | "regions.uk"
  | "regions.canada"
  | "regions.australia"
  | "regions.india"
  | "regions.latinAmerica"
  | "regions.middleEast"
  | "regions.africa"

type Translations = Record<TranslationKey, string>
type TranslationMap = Record<SupportedLanguage, Translations>

const translations: TranslationMap = {
  en: {
    "nav.home": "Home",
    "nav.tools": "Tools",
    "nav.collections": "Collections",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.reviews": "Reviews",
    "nav.signIn": "Sign In",
    "nav.signOut": "Sign Out",
    "nav.getStarted": "Get Started",
    "search.placeholder": "Search AI tools...",
    "search.filters": "Filters",
    "search.pricingModel": "Pricing Model",
    "search.region": "Region",
    "search.selectRegion": "Select Region",
    "search.anyPrice": "Any Price",
    "search.reset": "Reset",
    "search.noToolsFound": "No tools found",
    "search.tryAdjusting": "Try adjusting your search or filters",
    "search.loadMore": "Load More Tools",
    "search.showing": "Showing {count} tools. Click to load more.",
    "search.personalized": "Personalized results",
    "tools.featured": "Featured",
    "tools.details": "Details",
    "tools.addToFavorites": "Add to favorites",
    "tools.removeFromFavorites": "Remove from favorites",
    "tools.signInToSave": "Please sign in to save tools",
    "tools.category.all": "All",
    "common.loading": "Loading...",
    "common.retry": "Retry",
    "common.language": "Language",
    "regions.global": "🌍 Global (Any Region)",
    "regions.usa": "🇺🇸 United States",
    "regions.europe": "🇪🇺 Europe",
    "regions.asia": "🌏 Asia",
    "regions.asiaPacific": "🌏 Asia Pacific",
    "regions.uk": "🇬🇧 United Kingdom",
    "regions.canada": "🇨🇦 Canada",
    "regions.australia": "🇦🇺 Australia",
    "regions.india": "🇮🇳 India",
    "regions.latinAmerica": "🌎 Latin America",
    "regions.middleEast": "🌍 Middle East",
    "regions.africa": "🌍 Africa",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.tools": "Outils",
    "nav.collections": "Collections",
    "nav.profile": "Profil",
    "nav.settings": "Paramètres",
    "nav.reviews": "Avis",
    "nav.signIn": "Se connecter",
    "nav.signOut": "Se déconnecter",
    "nav.getStarted": "Commencer",
    "search.placeholder": "Rechercher des outils IA...",
    "search.filters": "Filtres",
    "search.pricingModel": "Modèle de tarification",
    "search.region": "Région",
    "search.selectRegion": "Sélectionner une région",
    "search.anyPrice": "Tout prix",
    "search.reset": "Réinitialiser",
    "search.noToolsFound": "Aucun outil trouvé",
    "search.tryAdjusting": "Essayez de modifier votre recherche ou vos filtres",
    "search.loadMore": "Charger plus d'outils",
    "search.showing": "Affichage de {count} outils. Cliquez pour en charger plus.",
    "search.personalized": "Résultats personnalisés",
    "tools.featured": "En vedette",
    "tools.details": "Détails",
    "tools.addToFavorites": "Ajouter aux favoris",
    "tools.removeFromFavorites": "Retirer des favoris",
    "tools.signInToSave": "Connectez-vous pour enregistrer des outils",
    "tools.category.all": "Tous",
    "common.loading": "Chargement...",
    "common.retry": "Réessayer",
    "common.language": "Langue",
    "regions.global": "🌍 Mondial (toutes régions)",
    "regions.usa": "🇺🇸 États-Unis",
    "regions.europe": "🇪🇺 Europe",
    "regions.asia": "🌏 Asie",
    "regions.asiaPacific": "🌏 Asie-Pacifique",
    "regions.uk": "🇬🇧 Royaume-Uni",
    "regions.canada": "🇨🇦 Canada",
    "regions.australia": "🇦🇺 Australie",
    "regions.india": "🇮🇳 Inde",
    "regions.latinAmerica": "🌎 Amérique latine",
    "regions.middleEast": "🌍 Moyen-Orient",
    "regions.africa": "🌍 Afrique",
  },
  es: {
    "nav.home": "Inicio",
    "nav.tools": "Herramientas",
    "nav.collections": "Colecciones",
    "nav.profile": "Perfil",
    "nav.settings": "Configuración",
    "nav.reviews": "Reseñas",
    "nav.signIn": "Iniciar sesión",
    "nav.signOut": "Cerrar sesión",
    "nav.getStarted": "Empezar",
    "search.placeholder": "Buscar herramientas de IA...",
    "search.filters": "Filtros",
    "search.pricingModel": "Modelo de precios",
    "search.region": "Región",
    "search.selectRegion": "Seleccionar región",
    "search.anyPrice": "Cualquier precio",
    "search.reset": "Restablecer",
    "search.noToolsFound": "No se encontraron herramientas",
    "search.tryAdjusting": "Intenta ajustar tu búsqueda o filtros",
    "search.loadMore": "Cargar más herramientas",
    "search.showing": "Mostrando {count} herramientas. Haz clic para cargar más.",
    "search.personalized": "Resultados personalizados",
    "tools.featured": "Destacado",
    "tools.details": "Detalles",
    "tools.addToFavorites": "Añadir a favoritos",
    "tools.removeFromFavorites": "Eliminar de favoritos",
    "tools.signInToSave": "Inicia sesión para guardar herramientas",
    "tools.category.all": "Todos",
    "common.loading": "Cargando...",
    "common.retry": "Reintentar",
    "common.language": "Idioma",
    "regions.global": "🌍 Global (cualquier región)",
    "regions.usa": "🇺🇸 Estados Unidos",
    "regions.europe": "🇪🇺 Europa",
    "regions.asia": "🌏 Asia",
    "regions.asiaPacific": "🌏 Asia-Pacífico",
    "regions.uk": "🇬🇧 Reino Unido",
    "regions.canada": "🇨🇦 Canadá",
    "regions.australia": "🇦🇺 Australia",
    "regions.india": "🇮🇳 India",
    "regions.latinAmerica": "🌎 América Latina",
    "regions.middleEast": "🌍 Oriente Medio",
    "regions.africa": "🌍 África",
  },
  de: {
    "nav.home": "Startseite",
    "nav.tools": "Tools",
    "nav.collections": "Sammlungen",
    "nav.profile": "Profil",
    "nav.settings": "Einstellungen",
    "nav.reviews": "Bewertungen",
    "nav.signIn": "Anmelden",
    "nav.signOut": "Abmelden",
    "nav.getStarted": "Loslegen",
    "search.placeholder": "KI-Tools suchen...",
    "search.filters": "Filter",
    "search.pricingModel": "Preismodell",
    "search.region": "Region",
    "search.selectRegion": "Region auswählen",
    "search.anyPrice": "Beliebiger Preis",
    "search.reset": "Zurücksetzen",
    "search.noToolsFound": "Keine Tools gefunden",
    "search.tryAdjusting": "Suche oder Filter anpassen",
    "search.loadMore": "Weitere Tools laden",
    "search.showing": "{count} Tools angezeigt. Klicken für mehr.",
    "search.personalized": "Personalisierte Ergebnisse",
    "tools.featured": "Hervorgehoben",
    "tools.details": "Details",
    "tools.addToFavorites": "Zu Favoriten hinzufügen",
    "tools.removeFromFavorites": "Aus Favoriten entfernen",
    "tools.signInToSave": "Anmelden um Tools zu speichern",
    "tools.category.all": "Alle",
    "common.loading": "Wird geladen...",
    "common.retry": "Erneut versuchen",
    "common.language": "Sprache",
    "regions.global": "🌍 Global (alle Regionen)",
    "regions.usa": "🇺🇸 Vereinigte Staaten",
    "regions.europe": "🇪🇺 Europa",
    "regions.asia": "🌏 Asien",
    "regions.asiaPacific": "🌏 Asien-Pazifik",
    "regions.uk": "🇬🇧 Vereinigtes Königreich",
    "regions.canada": "🇨🇦 Kanada",
    "regions.australia": "🇦🇺 Australien",
    "regions.india": "🇮🇳 Indien",
    "regions.latinAmerica": "🌎 Lateinamerika",
    "regions.middleEast": "🌍 Naher Osten",
    "regions.africa": "🌍 Afrika",
  },
  pt: {
    "nav.home": "Início",
    "nav.tools": "Ferramentas",
    "nav.collections": "Coleções",
    "nav.profile": "Perfil",
    "nav.settings": "Configurações",
    "nav.reviews": "Avaliações",
    "nav.signIn": "Entrar",
    "nav.signOut": "Sair",
    "nav.getStarted": "Começar",
    "search.placeholder": "Pesquisar ferramentas de IA...",
    "search.filters": "Filtros",
    "search.pricingModel": "Modelo de preços",
    "search.region": "Região",
    "search.selectRegion": "Selecionar região",
    "search.anyPrice": "Qualquer preço",
    "search.reset": "Redefinir",
    "search.noToolsFound": "Nenhuma ferramenta encontrada",
    "search.tryAdjusting": "Tente ajustar sua pesquisa ou filtros",
    "search.loadMore": "Carregar mais ferramentas",
    "search.showing": "Mostrando {count} ferramentas. Clique para carregar mais.",
    "search.personalized": "Resultados personalizados",
    "tools.featured": "Destaque",
    "tools.details": "Detalhes",
    "tools.addToFavorites": "Adicionar aos favoritos",
    "tools.removeFromFavorites": "Remover dos favoritos",
    "tools.signInToSave": "Entre para salvar ferramentas",
    "tools.category.all": "Todos",
    "common.loading": "Carregando...",
    "common.retry": "Tentar novamente",
    "common.language": "Idioma",
    "regions.global": "🌍 Global (qualquer região)",
    "regions.usa": "🇺🇸 Estados Unidos",
    "regions.europe": "🇪🇺 Europa",
    "regions.asia": "🌏 Ásia",
    "regions.asiaPacific": "🌏 Ásia-Pacífico",
    "regions.uk": "🇬🇧 Reino Unido",
    "regions.canada": "🇨🇦 Canadá",
    "regions.australia": "🇦🇺 Austrália",
    "regions.india": "🇮🇳 Índia",
    "regions.latinAmerica": "🌎 América Latina",
    "regions.middleEast": "🌍 Oriente Médio",
    "regions.africa": "🌍 África",
  },
  ja: {
    "nav.home": "ホーム",
    "nav.tools": "ツール",
    "nav.collections": "コレクション",
    "nav.profile": "プロフィール",
    "nav.settings": "設定",
    "nav.reviews": "レビュー",
    "nav.signIn": "サインイン",
    "nav.signOut": "サインアウト",
    "nav.getStarted": "始める",
    "search.placeholder": "AIツールを検索...",
    "search.filters": "フィルター",
    "search.pricingModel": "料金モデル",
    "search.region": "地域",
    "search.selectRegion": "地域を選択",
    "search.anyPrice": "すべての価格",
    "search.reset": "リセット",
    "search.noToolsFound": "ツールが見つかりません",
    "search.tryAdjusting": "検索やフィルターを調整してください",
    "search.loadMore": "もっと読み込む",
    "search.showing": "{count}件のツールを表示中。クリックしてさらに読み込む。",
    "search.personalized": "パーソナライズされた結果",
    "tools.featured": "注目",
    "tools.details": "詳細",
    "tools.addToFavorites": "お気に入りに追加",
    "tools.removeFromFavorites": "お気に入りから削除",
    "tools.signInToSave": "ツールを保存するにはサインインしてください",
    "tools.category.all": "すべて",
    "common.loading": "読み込み中...",
    "common.retry": "再試行",
    "common.language": "言語",
    "regions.global": "🌍 グローバル（全地域）",
    "regions.usa": "🇺🇸 アメリカ",
    "regions.europe": "🇪🇺 ヨーロッパ",
    "regions.asia": "🌏 アジア",
    "regions.asiaPacific": "🌏 アジア太平洋",
    "regions.uk": "🇬🇧 イギリス",
    "regions.canada": "🇨🇦 カナダ",
    "regions.australia": "🇦🇺 オーストラリア",
    "regions.india": "🇮🇳 インド",
    "regions.latinAmerica": "🌎 ラテンアメリカ",
    "regions.middleEast": "🌍 中東",
    "regions.africa": "🌍 アフリカ",
  },
  zh: {
    "nav.home": "首页",
    "nav.tools": "工具",
    "nav.collections": "收藏",
    "nav.profile": "个人资料",
    "nav.settings": "设置",
    "nav.reviews": "评论",
    "nav.signIn": "登录",
    "nav.signOut": "退出",
    "nav.getStarted": "开始使用",
    "search.placeholder": "搜索AI工具...",
    "search.filters": "筛选",
    "search.pricingModel": "定价模式",
    "search.region": "地区",
    "search.selectRegion": "选择地区",
    "search.anyPrice": "任意价格",
    "search.reset": "重置",
    "search.noToolsFound": "未找到工具",
    "search.tryAdjusting": "请尝试调整搜索或筛选条件",
    "search.loadMore": "加载更多工具",
    "search.showing": "显示 {count} 个工具。点击加载更多。",
    "search.personalized": "个性化结果",
    "tools.featured": "推荐",
    "tools.details": "详情",
    "tools.addToFavorites": "添加到收藏",
    "tools.removeFromFavorites": "从收藏中移除",
    "tools.signInToSave": "请登录以保存工具",
    "tools.category.all": "全部",
    "common.loading": "加载中...",
    "common.retry": "重试",
    "common.language": "语言",
    "regions.global": "🌍 全球（任意地区）",
    "regions.usa": "🇺🇸 美国",
    "regions.europe": "🇪🇺 欧洲",
    "regions.asia": "🌏 亚洲",
    "regions.asiaPacific": "🌏 亚太",
    "regions.uk": "🇬🇧 英国",
    "regions.canada": "🇨🇦 加拿大",
    "regions.australia": "🇦🇺 澳大利亚",
    "regions.india": "🇮🇳 印度",
    "regions.latinAmerica": "🌎 拉丁美洲",
    "regions.middleEast": "🌍 中东",
    "regions.africa": "🌍 非洲",
  },
  ko: {
    "nav.home": "홈", "nav.tools": "도구", "nav.collections": "컬렉션", "nav.profile": "프로필",
    "nav.settings": "설정", "nav.reviews": "리뷰", "nav.signIn": "로그인", "nav.signOut": "로그아웃",
    "nav.getStarted": "시작하기", "search.placeholder": "AI 도구 검색...", "search.filters": "필터",
    "search.pricingModel": "가격 모델", "search.region": "지역", "search.selectRegion": "지역 선택",
    "search.anyPrice": "모든 가격", "search.reset": "초기화", "search.noToolsFound": "도구를 찾을 수 없습니다",
    "search.tryAdjusting": "검색어나 필터를 조정해 보세요", "search.loadMore": "더 많은 도구 로드",
    "search.showing": "{count}개 도구 표시 중. 더 보려면 클릭하세요.", "search.personalized": "맞춤 결과",
    "tools.featured": "추천", "tools.details": "상세", "tools.addToFavorites": "즐겨찾기에 추가",
    "tools.removeFromFavorites": "즐겨찾기에서 제거", "tools.signInToSave": "도구를 저장하려면 로그인하세요",
    "tools.category.all": "전체", "common.loading": "로딩 중...", "common.retry": "재시도", "common.language": "언어",
    "regions.global": "🌍 글로벌", "regions.usa": "🇺🇸 미국", "regions.europe": "🇪🇺 유럽",
    "regions.asia": "🌏 아시아", "regions.asiaPacific": "🌏 아시아 태평양", "regions.uk": "🇬🇧 영국",
    "regions.canada": "🇨🇦 캐나다", "regions.australia": "🇦🇺 호주", "regions.india": "🇮🇳 인도",
    "regions.latinAmerica": "🌎 라틴 아메리카", "regions.middleEast": "🌍 중동", "regions.africa": "🌍 아프리카",
  },
  th: {
    "nav.home": "หน้าแรก", "nav.tools": "เครื่องมือ", "nav.collections": "คอลเลกชัน", "nav.profile": "โปรไฟล์",
    "nav.settings": "ตั้งค่า", "nav.reviews": "รีวิว", "nav.signIn": "เข้าสู่ระบบ", "nav.signOut": "ออกจากระบบ",
    "nav.getStarted": "เริ่มต้นใช้งาน", "search.placeholder": "ค้นหาเครื่องมือ AI...", "search.filters": "ตัวกรอง",
    "search.pricingModel": "รูปแบบราคา", "search.region": "ภูมิภาค", "search.selectRegion": "เลือกภูมิภาค",
    "search.anyPrice": "ทุกราคา", "search.reset": "รีเซ็ต", "search.noToolsFound": "ไม่พบเครื่องมือ",
    "search.tryAdjusting": "ลองปรับการค้นหาหรือตัวกรอง", "search.loadMore": "โหลดเพิ่มเติม",
    "search.showing": "แสดง {count} เครื่องมือ คลิกเพื่อโหลดเพิ่ม", "search.personalized": "ผลลัพธ์ที่ปรับแต่ง",
    "tools.featured": "แนะนำ", "tools.details": "รายละเอียด", "tools.addToFavorites": "เพิ่มในรายการโปรด",
    "tools.removeFromFavorites": "ลบจากรายการโปรด", "tools.signInToSave": "เข้าสู่ระบบเพื่อบันทึกเครื่องมือ",
    "tools.category.all": "ทั้งหมด", "common.loading": "กำลังโหลด...", "common.retry": "ลองอีกครั้ง", "common.language": "ภาษา",
    "regions.global": "🌍 ทั่วโลก", "regions.usa": "🇺🇸 สหรัฐอเมริกา", "regions.europe": "🇪🇺 ยุโรป",
    "regions.asia": "🌏 เอเชีย", "regions.asiaPacific": "🌏 เอเชียแปซิฟิก", "regions.uk": "🇬🇧 สหราชอาณาจักร",
    "regions.canada": "🇨🇦 แคนาดา", "regions.australia": "🇦🇺 ออสเตรเลีย", "regions.india": "🇮🇳 อินเดีย",
    "regions.latinAmerica": "🌎 ละตินอเมริกา", "regions.middleEast": "🌍 ตะวันออกกลาง", "regions.africa": "🌍 แอฟริกา",
  },
  tl: {
    "nav.home": "Home", "nav.tools": "Mga Tool", "nav.collections": "Mga Koleksyon", "nav.profile": "Profile",
    "nav.settings": "Mga Setting", "nav.reviews": "Mga Review", "nav.signIn": "Mag-sign In", "nav.signOut": "Mag-sign Out",
    "nav.getStarted": "Magsimula", "search.placeholder": "Maghanap ng AI tool...", "search.filters": "Mga Filter",
    "search.pricingModel": "Modelo ng Presyo", "search.region": "Rehiyon", "search.selectRegion": "Pumili ng Rehiyon",
    "search.anyPrice": "Anumang Presyo", "search.reset": "I-reset", "search.noToolsFound": "Walang nahanap na tool",
    "search.tryAdjusting": "Subukang baguhin ang iyong paghahanap o mga filter", "search.loadMore": "Mag-load pa",
    "search.showing": "Nagpapakita ng {count} na tool. I-click para mag-load pa.", "search.personalized": "Personalized na resulta",
    "tools.featured": "Featured", "tools.details": "Detalye", "tools.addToFavorites": "Idagdag sa paborito",
    "tools.removeFromFavorites": "Alisin sa paborito", "tools.signInToSave": "Mag-sign in para mag-save ng tool",
    "tools.category.all": "Lahat", "common.loading": "Naglo-load...", "common.retry": "Subukan muli", "common.language": "Wika",
    "regions.global": "🌍 Global", "regions.usa": "🇺🇸 Estados Unidos", "regions.europe": "🇪🇺 Europa",
    "regions.asia": "🌏 Asya", "regions.asiaPacific": "🌏 Asya Pasipiko", "regions.uk": "🇬🇧 United Kingdom",
    "regions.canada": "🇨🇦 Canada", "regions.australia": "🇦🇺 Australia", "regions.india": "🇮🇳 India",
    "regions.latinAmerica": "🌎 Latin America", "regions.middleEast": "🌍 Gitnang Silangan", "regions.africa": "🌍 Aprika",
  },
  vi: {
    "nav.home": "Trang chủ", "nav.tools": "Công cụ", "nav.collections": "Bộ sưu tập", "nav.profile": "Hồ sơ",
    "nav.settings": "Cài đặt", "nav.reviews": "Đánh giá", "nav.signIn": "Đăng nhập", "nav.signOut": "Đăng xuất",
    "nav.getStarted": "Bắt đầu", "search.placeholder": "Tìm công cụ AI...", "search.filters": "Bộ lọc",
    "search.pricingModel": "Mô hình giá", "search.region": "Khu vực", "search.selectRegion": "Chọn khu vực",
    "search.anyPrice": "Mọi giá", "search.reset": "Đặt lại", "search.noToolsFound": "Không tìm thấy công cụ",
    "search.tryAdjusting": "Hãy thử điều chỉnh tìm kiếm hoặc bộ lọc", "search.loadMore": "Tải thêm",
    "search.showing": "Hiển thị {count} công cụ. Nhấn để tải thêm.", "search.personalized": "Kết quả cá nhân hóa",
    "tools.featured": "Nổi bật", "tools.details": "Chi tiết", "tools.addToFavorites": "Thêm vào yêu thích",
    "tools.removeFromFavorites": "Xóa khỏi yêu thích", "tools.signInToSave": "Đăng nhập để lưu công cụ",
    "tools.category.all": "Tất cả", "common.loading": "Đang tải...", "common.retry": "Thử lại", "common.language": "Ngôn ngữ",
    "regions.global": "🌍 Toàn cầu", "regions.usa": "🇺🇸 Hoa Kỳ", "regions.europe": "🇪🇺 Châu Âu",
    "regions.asia": "🌏 Châu Á", "regions.asiaPacific": "🌏 Châu Á TBD", "regions.uk": "🇬🇧 Anh Quốc",
    "regions.canada": "🇨🇦 Canada", "regions.australia": "🇦🇺 Úc", "regions.india": "🇮🇳 Ấn Độ",
    "regions.latinAmerica": "🌎 Mỹ Latinh", "regions.middleEast": "🌍 Trung Đông", "regions.africa": "🌍 Châu Phi",
  },
  id: {
    "nav.home": "Beranda", "nav.tools": "Alat", "nav.collections": "Koleksi", "nav.profile": "Profil",
    "nav.settings": "Pengaturan", "nav.reviews": "Ulasan", "nav.signIn": "Masuk", "nav.signOut": "Keluar",
    "nav.getStarted": "Mulai", "search.placeholder": "Cari alat AI...", "search.filters": "Filter",
    "search.pricingModel": "Model Harga", "search.region": "Wilayah", "search.selectRegion": "Pilih Wilayah",
    "search.anyPrice": "Semua Harga", "search.reset": "Reset", "search.noToolsFound": "Alat tidak ditemukan",
    "search.tryAdjusting": "Coba sesuaikan pencarian atau filter", "search.loadMore": "Muat lebih banyak",
    "search.showing": "Menampilkan {count} alat. Klik untuk muat lebih.", "search.personalized": "Hasil personal",
    "tools.featured": "Unggulan", "tools.details": "Detail", "tools.addToFavorites": "Tambah ke favorit",
    "tools.removeFromFavorites": "Hapus dari favorit", "tools.signInToSave": "Masuk untuk menyimpan alat",
    "tools.category.all": "Semua", "common.loading": "Memuat...", "common.retry": "Coba lagi", "common.language": "Bahasa",
    "regions.global": "🌍 Global", "regions.usa": "🇺🇸 Amerika Serikat", "regions.europe": "🇪🇺 Eropa",
    "regions.asia": "🌏 Asia", "regions.asiaPacific": "🌏 Asia Pasifik", "regions.uk": "🇬🇧 Inggris",
    "regions.canada": "🇨🇦 Kanada", "regions.australia": "🇦🇺 Australia", "regions.india": "🇮🇳 India",
    "regions.latinAmerica": "🌎 Amerika Latin", "regions.middleEast": "🌍 Timur Tengah", "regions.africa": "🌍 Afrika",
  },
  hi: {
    "nav.home": "होम", "nav.tools": "टूल्स", "nav.collections": "संग्रह", "nav.profile": "प्रोफ़ाइल",
    "nav.settings": "सेटिंग्स", "nav.reviews": "समीक्षा", "nav.signIn": "साइन इन", "nav.signOut": "साइन आउट",
    "nav.getStarted": "शुरू करें", "search.placeholder": "AI टूल्स खोजें...", "search.filters": "फ़िल्टर",
    "search.pricingModel": "मूल्य मॉडल", "search.region": "क्षेत्र", "search.selectRegion": "क्षेत्र चुनें",
    "search.anyPrice": "कोई भी मूल्य", "search.reset": "रीसेट", "search.noToolsFound": "कोई टूल नहीं मिला",
    "search.tryAdjusting": "अपनी खोज या फ़िल्टर समायोजित करें", "search.loadMore": "और लोड करें",
    "search.showing": "{count} टूल्स दिखा रहे हैं। और लोड करने के लिए क्लिक करें।", "search.personalized": "व्यक्तिगत परिणाम",
    "tools.featured": "विशेष", "tools.details": "विवरण", "tools.addToFavorites": "पसंदीदा में जोड़ें",
    "tools.removeFromFavorites": "पसंदीदा से हटाएं", "tools.signInToSave": "टूल्स सहेजने के लिए साइन इन करें",
    "tools.category.all": "सभी", "common.loading": "लोड हो रहा है...", "common.retry": "पुन: प्रयास", "common.language": "भाषा",
    "regions.global": "🌍 वैश्विक", "regions.usa": "🇺🇸 अमेरिका", "regions.europe": "🇪🇺 यूरोप",
    "regions.asia": "🌏 एशिया", "regions.asiaPacific": "🌏 एशिया प्रशांत", "regions.uk": "🇬🇧 ब्रिटेन",
    "regions.canada": "🇨🇦 कनाडा", "regions.australia": "🇦🇺 ऑस्ट्रेलिया", "regions.india": "🇮🇳 भारत",
    "regions.latinAmerica": "🌎 लैटिन अमेरिका", "regions.middleEast": "🌍 मध्य पूर्व", "regions.africa": "🌍 अफ़्रीका",
  },
  ar: {
    "nav.home": "الرئيسية", "nav.tools": "الأدوات", "nav.collections": "المجموعات", "nav.profile": "الملف الشخصي",
    "nav.settings": "الإعدادات", "nav.reviews": "المراجعات", "nav.signIn": "تسجيل الدخول", "nav.signOut": "تسجيل الخروج",
    "nav.getStarted": "ابدأ الآن", "search.placeholder": "ابحث عن أدوات AI...", "search.filters": "التصفية",
    "search.pricingModel": "نموذج التسعير", "search.region": "المنطقة", "search.selectRegion": "اختر المنطقة",
    "search.anyPrice": "أي سعر", "search.reset": "إعادة تعيين", "search.noToolsFound": "لم يتم العثور على أدوات",
    "search.tryAdjusting": "حاول تعديل البحث أو التصفية", "search.loadMore": "تحميل المزيد",
    "search.showing": "عرض {count} أداة. انقر لتحميل المزيد.", "search.personalized": "نتائج مخصصة",
    "tools.featured": "مميز", "tools.details": "تفاصيل", "tools.addToFavorites": "إضافة إلى المفضلة",
    "tools.removeFromFavorites": "إزالة من المفضلة", "tools.signInToSave": "سجّل الدخول لحفظ الأدوات",
    "tools.category.all": "الكل", "common.loading": "جار التحميل...", "common.retry": "إعادة المحاولة", "common.language": "اللغة",
    "regions.global": "🌍 عالمي", "regions.usa": "🇺🇸 الولايات المتحدة", "regions.europe": "🇪🇺 أوروبا",
    "regions.asia": "🌏 آسيا", "regions.asiaPacific": "🌏 آسيا والمحيط الهادئ", "regions.uk": "🇬🇧 المملكة المتحدة",
    "regions.canada": "🇨🇦 كندا", "regions.australia": "🇦🇺 أستراليا", "regions.india": "🇮🇳 الهند",
    "regions.latinAmerica": "🌎 أمريكا اللاتينية", "regions.middleEast": "🌍 الشرق الأوسط", "regions.africa": "🌍 أفريقيا",
  },
  tr: {
    "nav.home": "Ana Sayfa", "nav.tools": "Araçlar", "nav.collections": "Koleksiyonlar", "nav.profile": "Profil",
    "nav.settings": "Ayarlar", "nav.reviews": "Yorumlar", "nav.signIn": "Giriş Yap", "nav.signOut": "Çıkış Yap",
    "nav.getStarted": "Başla", "search.placeholder": "AI araçları ara...", "search.filters": "Filtreler",
    "search.pricingModel": "Fiyat Modeli", "search.region": "Bölge", "search.selectRegion": "Bölge Seç",
    "search.anyPrice": "Herhangi Bir Fiyat", "search.reset": "Sıfırla", "search.noToolsFound": "Araç bulunamadı",
    "search.tryAdjusting": "Aramanızı veya filtrelerinizi ayarlamayı deneyin", "search.loadMore": "Daha Fazla Yükle",
    "search.showing": "{count} araç gösteriliyor. Daha fazlası için tıklayın.", "search.personalized": "Kişiselleştirilmiş sonuçlar",
    "tools.featured": "Öne Çıkan", "tools.details": "Detaylar", "tools.addToFavorites": "Favorilere ekle",
    "tools.removeFromFavorites": "Favorilerden kaldır", "tools.signInToSave": "Araçları kaydetmek için giriş yapın",
    "tools.category.all": "Tümü", "common.loading": "Yükleniyor...", "common.retry": "Tekrar Dene", "common.language": "Dil",
    "regions.global": "🌍 Küresel", "regions.usa": "🇺🇸 ABD", "regions.europe": "🇪🇺 Avrupa",
    "regions.asia": "🌏 Asya", "regions.asiaPacific": "🌏 Asya Pasifik", "regions.uk": "🇬🇧 Birleşik Krallık",
    "regions.canada": "🇨🇦 Kanada", "regions.australia": "🇦🇺 Avustralya", "regions.india": "🇮🇳 Hindistan",
    "regions.latinAmerica": "🌎 Latin Amerika", "regions.middleEast": "🌍 Orta Doğu", "regions.africa": "🌍 Afrika",
  },
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface LanguageContextValue {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  currentLanguage: LanguageOption
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const STORAGE_KEY = "arcynfind_language"

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("en")

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null
    const valid = LANGUAGES.map(l => l.code)
    if (saved && valid.includes(saved)) {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
    // Update <html lang=""> attribute for accessibility
    document.documentElement.lang = lang
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      let text = translations[language]?.[key] ?? translations["en"][key] ?? key
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v))
        })
      }
      return text
    },
    [language]
  )

  const currentLanguage = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0]

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, currentLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>")
  return ctx
}
