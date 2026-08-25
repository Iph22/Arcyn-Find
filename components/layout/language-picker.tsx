"use client"

import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage, LANGUAGES, type SupportedLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

interface LanguagePickerProps {
  className?: string
  /** "icon" shows only the globe icon (navbar use), "full" shows flag + name */
  variant?: "icon" | "full"
}

export function LanguagePicker({ className, variant = "icon" }: LanguagePickerProps) {
  const { language, setLanguage, currentLanguage, t } = useLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === "icon" ? "icon" : "sm"}
          className={cn(
            "h-8 w-8 md:h-9 md:w-9 rounded-full transition-colors",
            variant === "full" && "w-auto gap-2 px-3",
            className
          )}
          aria-label={t("common.language")}
          title={t("common.language")}
        >
          {variant === "full" ? (
            <>
              <span className="text-base">{currentLanguage.flag}</span>
              <span className="text-xs font-medium">{currentLanguage.nativeLabel}</span>
            </>
          ) : (
            <span className="text-base leading-none" title={currentLanguage.nativeLabel}>
              {currentLanguage.flag}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Globe className="h-3 w-3" />
          {t("common.language")}
        </div>
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code as SupportedLanguage)}
            className={cn(
              "flex items-center gap-3 cursor-pointer",
              language === lang.code && "bg-primary/10 text-primary font-medium"
            )}
          >
            <span className="text-base">{lang.flag}</span>
            <div className="flex flex-col">
              <span className="text-sm leading-tight">{lang.nativeLabel}</span>
              {lang.nativeLabel !== lang.label && (
                <span className="text-xs text-muted-foreground leading-tight">{lang.label}</span>
              )}
            </div>
            {language === lang.code && (
              <span className="ml-auto text-xs text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
