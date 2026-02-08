# PowerShell script to apply pagination validation to remaining endpoints

$files = @(
    "app/api/newsletter/route.ts",
    "app/api/media/route.ts",
    "app/api/announcements/route.ts",
    "app/api/announcements/[id]/revisions/route.ts",
    "app/api/announcements/[id]/comments/route.ts"
)

foreach ($file in $files) {
    $path = "e:\Vibe\Dashboard SJA\announcement-dashboard\$file"
    
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        
        # Add import if not exists
        if ($content -notmatch "validatePagination") {
            $content = $content -replace "(import.*from ['\`"]@/lib/prisma['\`"];)", "`$1`nimport { validatePagination } from '@/lib/pagination-utils';"
        }
        
        # Replace pagination parsing
        $content = $content -replace 'const page = parseInt\(.*?\.get\("page"\).*?\);', '// Validated by validatePagination'
        $content = $content -replace 'const limit = parseInt\(.*?\.get\("limit"\).*?\);', '        const pageParam = url.searchParams.get("page") || searchParams.get("page");
        const limitParam = url.searchParams.get("limit") || searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);
        if (paginationError) { console.warn(`Pagination warning: ${paginationError}`); }'
        
        # Replace skip calculation
        $content = $content -replace 'const skip = \(page - 1\) \* limit;', '// skip calculated by validatePagination'
        $content = $content -replace 'skip: \(page - 1\) \* limit,', 'skip,'
        
        # Replace page in response
        $content = $content -replace 'page,(\s+limit,)', 'page: Math.floor(skip / limit) + 1,$1'
        
        Set-Content $path -Value $content -NoNewline
        Write-Host "Updated: $file" -ForegroundColor Green
    }
    else {
        Write-Host "Not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nCompleted pagination updates!" -ForegroundColor Cyan
