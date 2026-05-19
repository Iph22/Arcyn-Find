"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

// ---------------------------------------------------------------------------
// Supported languages
// ---------------------------------------------------------------------------

export type SupportedLanguage = "en" | "fr" | "es" | "de" | "pt" | "ja" | "zh"

export interface LanguageOption {
  code: SupportedLanguage
  label: string
  flag: string
  nativeLabel: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English",    flag: "🇬🇧", nativeLabel: "English"    },
  { code: "fr", label: "French",     flag: "🇫🇷", nativeLabel: "Français"   },
  { code: "es", label: "Spanish",    flag: "🇪🇸", nativeLabel: "Español"    },
  { code: "de", label: "German",     flag: "🇩🇪", nativeLabel: "Deutsch"    },
  { code: "pt", label: "Portuguese", flag: "🇧🇷", nativeLabel: "Português"  },
  { code: "ja", label: "Japanese",   flag: "🇯🇵", nativeLabel: "日本語"      },
  { code: "zh", label: "Chinese",    flag: "🇨🇳", nativeLabel: "中文"        },
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
