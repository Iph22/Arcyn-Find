$replacements = @{
    "@/components/loading-skeleton" = "@/components/feedback/loading-skeleton"
    "@/components/empty-state" = "@/components/feedback/empty-state"
    "@/components/maintenance-scene" = "@/components/feedback/maintenance-scene"
    "@/components/onboarding-modal" = "@/components/feedback/onboarding-modal"
    "@/components/sidebar" = "@/components/layout/sidebar"
    "@/components/theme-toggle" = "@/components/layout/theme-toggle"
    "@/components/language-picker" = "@/components/layout/language-picker"
    "@/components/navbar" = "@/components/layout/navbar"
    "@/components/mobile-nav" = "@/components/layout/mobile-nav"
    "@/components/premium-search-input" = "@/components/search/premium-search-input"
    "@/components/ai-suggestions" = "@/components/search/ai-suggestions"
    "@/components/search-skeleton" = "@/components/search/search-skeleton"
    "@/components/search-highlight" = "@/components/search/search-highlight"
    "@/components/browser-search-animation" = "@/components/search/browser-search-animation"
    "@/components/filter-bar" = "@/components/search/filter-bar"
    "@/components/search-bar" = "@/components/search/search-bar"
    "@/components/user-search" = "@/components/search/user-search"
    "@/components/enhanced-tool-detail-modal" = "@/components/tools/enhanced-tool-detail-modal"
    "@/components/pricing-badge" = "@/components/tools/pricing-badge"
    "@/components/review-card" = "@/components/tools/review-card"
    "@/components/tool-image" = "@/components/tools/tool-image"
    "@/components/collection-card" = "@/components/tools/collection-card"
    "@/components/tool-card" = "@/components/tools/tool-card"
}

$files = Get-ChildItem -Path "c:\Users\DELL\Documents\ARCYN\Arcyn-Find\app" -Recurse -Filter "*.tsx"
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    foreach ($key in $replacements.Keys) {
        if ($content -match [regex]::Escape($key)) {
            $content = $content -replace [regex]::Escape($key), $replacements[$key]
            $modified = $true
        }
    }
    if ($modified) {
        Set-Content $file.FullName -Value $content -NoNewline
    }
}
