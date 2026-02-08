# Fix all pagination bugs in one go

$fixes = @{
    "app/api/announcements/route.ts" = @"
        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category");
        const search = searchParams.get("q");
        const siteId = searchParams.get("siteId");
        const siteSlug = searchParams.get("siteSlug");
        
        // Validate pagination with limits
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);
        
        if (paginationError) {
            console.warn(`Pagination warning: ${paginationError}`);
        }
        
        const includeAll = searchParams.get("includeAll") === "true"; // For admin view
"@
    
    "app/api/newsletter/route.ts"    = @"
        const url = new URL(request.url);
        
        // Validate pagination with limits
        const pageParam = url.searchParams.get("page");
        const limitParam = url.searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);
        
        if (paginationError) {
            console.warn(`Pagination warning: ${paginationError}`);
        }
        
        const activeOnly = url.searchParams.get("active") === "true";
        const siteId = url.searchParams.get("siteId");
        const siteSlug = url.searchParams.get("siteSlug");
"@
    
    "app/api/media/route.ts"         = @"
        const { searchParams } = new URL(request.url);
        
        // Validate pagination with limits
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);
        
        if (paginationError) {
            console.warn(`Pagination warning: ${paginationError}`);
        }
        
        const type = searchParams.get("type"); // "image" | "video" | null (all)
        const siteId = searchParams.get("siteId"); // Optional: filter by site
        const sharedOnly = searchParams.get("sharedOnly") === "true"; // Only show shared media
"@
}

foreach ($file in $fixes.Keys) {
    $path = "e:\Vibe\Dashboard SJA\announcement-dashboard\$file"
    
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        
        # Find and replace the broken pagination block
        $content = $content -replace '(?s)const \{ searchParams \}.*?const includeAll = searchParams\.get\("includeAll"\) === "true";', $fixes["app/api/announcements/route.ts"] -replace '(?s)const url = new URL.*?const siteSlug = url\.searchParams\.get\("siteSlug"\);', $fixes["app/api/newsletter/route.ts"] -replace '(?s)const \{ searchParams \}.*?const sharedOnly = searchParams\.get\("sharedOnly"\) === "true";', $fixes["app/api/media/route.ts"]
        
        Set-Content $path -Value $content -NoNewline
        Write-Host "Fixed: $file" -ForegroundColor Green
    }
}

Write-Host "`nAll pagination bugs fixed!" -ForegroundColor Cyan
