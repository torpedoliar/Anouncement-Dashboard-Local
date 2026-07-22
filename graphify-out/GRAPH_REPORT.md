# Graph Report - E:/Vibe/Dashboard SJA/announcement-dashboard  (2026-07-22)

## Corpus Check
- 181 files · ~390,052 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 625 nodes · 896 edges · 91 communities (50 shown, 41 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin API & Site Context|Admin API & Site Context]]
- [[_COMMUNITY_Announcements & Validation|Announcements & Validation]]
- [[_COMMUNITY_Public Components & UI|Public Components & UI]]
- [[_COMMUNITY_Admin Dashboard & Analytics|Admin Dashboard & Analytics]]
- [[_COMMUNITY_Production Dependencies|Production Dependencies]]
- [[_COMMUNITY_Dev Dependencies & Config|Dev Dependencies & Config]]
- [[_COMMUNITY_Rich Text Editor & Media|Rich Text Editor & Media]]
- [[_COMMUNITY_TypeScript Configuration|TypeScript Configuration]]
- [[_COMMUNITY_Email System|Email System]]
- [[_COMMUNITY_Auth & Settings|Auth & Settings]]
- [[_COMMUNITY_Site Theme|Site Theme]]
- [[_COMMUNITY_Site Management API|Site Management API]]
- [[_COMMUNITY_Admin Layout|Admin Layout]]
- [[_COMMUNITY_Scheduler & Dashboard|Scheduler & Dashboard]]
- [[_COMMUNITY_Search & Pagination|Search & Pagination]]
- [[_COMMUNITY_Article Display|Article Display]]
- [[_COMMUNITY_Site Homepage|Site Homepage]]
- [[_COMMUNITY_Backup System|Backup System]]
- [[_COMMUNITY_Site Picker|Site Picker]]
- [[_COMMUNITY_Admin Sidebar|Admin Sidebar]]
- [[_COMMUNITY_Footer & Newsletter|Footer & Newsletter]]
- [[_COMMUNITY_Settings Page|Settings Page]]
- [[_COMMUNITY_Upload System|Upload System]]
- [[_COMMUNITY_Root Page|Root Page]]
- [[_COMMUNITY_Category Filter|Category Filter]]
- [[_COMMUNITY_Legacy Data Restore|Legacy Data Restore]]
- [[_COMMUNITY_User Management API|User Management API]]
- [[_COMMUNITY_Hero Section|Hero Section]]
- [[_COMMUNITY_Search Bar & Hooks|Search Bar & Hooks]]
- [[_COMMUNITY_Revision History|Revision History]]
- [[_COMMUNITY_Audit Logs|Audit Logs]]
- [[_COMMUNITY_Comments Management|Comments Management]]
- [[_COMMUNITY_Global Analytics|Global Analytics]]
- [[_COMMUNITY_Newsletter Admin|Newsletter Admin]]
- [[_COMMUNITY_Sessions Management|Sessions Management]]
- [[_COMMUNITY_Site Detail Page|Site Detail Page]]
- [[_COMMUNITY_Sites List|Sites List]]
- [[_COMMUNITY_Users Admin|Users Admin]]
- [[_COMMUNITY_Update API|Update API]]
- [[_COMMUNITY_Upload Path Route|Upload Path Route]]
- [[_COMMUNITY_Upload Filename Route|Upload Filename Route]]
- [[_COMMUNITY_Site Health Card|Site Health Card]]
- [[_COMMUNITY_Navbar|Navbar]]
- [[_COMMUNITY_Middleware|Middleware]]
- [[_COMMUNITY_Prisma Baseline|Prisma Baseline]]
- [[_COMMUNITY_Debug Parser|Debug Parser]]
- [[_COMMUNITY_Dump Lines|Dump Lines]]
- [[_COMMUNITY_Inspect Backup|Inspect Backup]]
- [[_COMMUNITY_NextAuth Types|NextAuth Types]]
- [[_COMMUNITY_Categories Admin|Categories Admin]]
- [[_COMMUNITY_Email Settings Page|Email Settings Page]]
- [[_COMMUNITY_Site Settings|Site Settings]]
- [[_COMMUNITY_Create Site Page|Create Site Page]]
- [[_COMMUNITY_Site Hero|Site Hero]]
- [[_COMMUNITY_Mark Baseline|Mark Baseline]]
- [[_COMMUNITY_Pre Migration|Pre Migration]]
- [[_COMMUNITY_Seed Script|Seed Script]]
- [[_COMMUNITY_Multisite Seed|Multisite Seed]]
- [[_COMMUNITY_Super Admin Script|Super Admin Script]]
- [[_COMMUNITY_Session Test|Session Test]]
- [[_COMMUNITY_Docker Entrypoint|Docker Entrypoint]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Backup Script (sh)|Backup Script (sh)]]
- [[_COMMUNITY_Backup Script (sh)|Backup Script (sh)]]
- [[_COMMUNITY_Deploy Script (sh)|Deploy Script (sh)]]
- [[_COMMUNITY_Restore Script (sh)|Restore Script (sh)]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]

## God Nodes (most connected - your core abstractions)
1. `authOptions` - 30 edges
2. `resolveAdminSiteId()` - 21 edges
3. `validatePagination()` - 17 edges
4. `compilerOptions` - 16 edges
5. `canAccessSite()` - 15 edges
6. `canEditOnSite()` - 14 edges
7. `getAccessibleSites()` - 12 edges
8. `POST()` - 8 edges
9. `maybeSendNewArticleEmails()` - 8 edges
10. `getCurrentSiteId()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `validatePagination()`  [EXTRACTED]
  app/api/announcements/[id]/comments/route.ts → lib/pagination-utils.ts
- `GET()` --calls--> `validatePagination()`  [EXTRACTED]
  app/api/announcements/route.ts → lib/pagination-utils.ts
- `MediaGalleryPage()` --calls--> `useToast()`  [EXTRACTED]
  app/admin/media/page.tsx → contexts/ToastContext.tsx
- `AdminDashboard()` --calls--> `resolveAdminSiteId()`  [EXTRACTED]
  app/admin/page.tsx → lib/site-context.ts
- `GET()` --calls--> `validatePagination()`  [EXTRACTED]
  app/api/announcements/[id]/revisions/route.ts → lib/pagination-utils.ts

## Import Cycles
- None detected.

## Communities (91 total, 41 thin omitted)

### Community 0 - "Admin API & Site Context"
Cohesion: 0.06
Nodes (46): EditAnnouncementPage(), getAnnouncement(), getCategories(), getCategories(), NewAnnouncementPage(), AnnouncementsPage(), getAnnouncements(), getCategories() (+38 more)

### Community 1 - "Announcements & Validation"
Cohesion: 0.08
Nodes (37): GET(), POST(), GET(), POST(), PUT(), GET(), POST(), DELETE() (+29 more)

### Community 2 - "Public Components & UI"
Cohesion: 0.08
Nodes (31): AnnouncementPage(), AnnouncementPageProps, calculateReadingTime(), getAnnouncement(), getCanonicalSitePath(), getRelatedAnnouncements(), getSettings(), Announcement (+23 more)

### Community 3 - "Admin Dashboard & Analytics"
Cohesion: 0.08
Nodes (20): Media, MediaGalleryPage(), inter, metadata, montserrat, AnalyticsDashboard(), AnalyticsData, AnalyticsSummary (+12 more)

### Community 4 - "Production Dependencies"
Cohesion: 0.07
Nodes (29): dependencies, autoprefixer, bcryptjs, date-fns, dotenv, handlebars, isomorphic-dompurify, next (+21 more)

### Community 5 - "Dev Dependencies & Config"
Cohesion: 0.08
Nodes (25): devDependencies, eslint, eslint-config-next, postcss, prisma, tailwindcss, tsx, @types/bcryptjs (+17 more)

### Community 6 - "Rich Text Editor & Media"
Cohesion: 0.09
Nodes (17): AnnouncementFormProps, Category, MediaType, LocalMedia, MediaFilterType, MediaPickerModalProps, StockMedia, TabType (+9 more)

### Community 7 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 8 - "Email System"
Cohesion: 0.23
Nodes (13): POST(), PUT(), DELETE(), POST(), compileTemplate(), getSenderInfo(), getTransporter(), resetTransporter() (+5 more)

### Community 9 - "Auth & Settings"
Cohesion: 0.21
Nodes (4): handler, PexelsPhoto, PexelsVideo, authOptions

### Community 10 - "Site Theme"
Cohesion: 0.18
Nodes (5): SiteTheme, SiteThemeContext, SiteThemeContextValue, SiteThemeProvider(), SiteThemeProviderProps

### Community 11 - "Site Management API"
Cohesion: 0.22
Nodes (6): PUT(), RouteParams, PUT(), RouteParams, canAdminSite(), getUserSiteRole()

### Community 12 - "Admin Layout"
Cohesion: 0.25
Nodes (3): AdminMainContent(), AdminMainContentProps, UpdateInfo

### Community 13 - "Scheduler & Dashboard"
Cohesion: 0.39
Nodes (6): AdminDashboard(), getRecentAnnouncements(), getStats(), GET(), runScheduler(), SchedulerResult

### Community 14 - "Search & Pagination"
Cohesion: 0.32
Nodes (5): getSettings(), searchAnnouncements(), SearchPage(), SearchPageProps, PaginationProps

### Community 15 - "Article Display"
Cohesion: 0.29
Nodes (4): ArticlePage(), getArticleData(), PageProps, ArticleHeroProps

### Community 16 - "Site Homepage"
Cohesion: 0.29
Nodes (5): getSiteData(), PageProps, SiteHomePage(), FullscreenHeroProps, HeroAnnouncement

### Community 17 - "Backup System"
Cohesion: 0.43
Nodes (5): POST(), restoreById(), restoreLegacy(), stripDates(), withDates()

### Community 18 - "Site Picker"
Cohesion: 0.43
Nodes (5): getActiveSites(), getGlobalSettings(), SitePickerPage(), SitePickerCard(), SitePickerCardProps

### Community 19 - "Admin Sidebar"
Cohesion: 0.29
Nodes (3): AdminSidebarProps, Site, SiteSelectorProps

### Community 20 - "Footer & Newsletter"
Cohesion: 0.29
Nodes (3): FooterProps, Settings, NewsletterSubscribeProps

### Community 22 - "Upload System"
Cohesion: 0.40
Nodes (5): ALLOWED_EXTENSIONS, ALLOWED_TYPES, POST(), sanitizeFilename(), UPLOAD_DIR

### Community 23 - "Root Page"
Cohesion: 0.60
Nodes (5): getAnnouncements(), getCategories(), getHeroAnnouncements(), getSettings(), HomePage()

### Community 24 - "Category Filter"
Cohesion: 0.33
Nodes (3): Category, CategoryFilterClient(), CategoryFilterProps

### Community 25 - "Legacy Data Restore"
Cohesion: 0.33
Nodes (4): fs, path, prisma, { PrismaClient }

### Community 27 - "Hero Section"
Cohesion: 0.50
Nodes (4): extractYoutubeId(), HeroAnnouncement, HeroSection(), HeroSectionProps

### Community 28 - "Search Bar & Hooks"
Cohesion: 0.60
Nodes (3): SearchBar(), SearchBarProps, useDebounce()

### Community 49 - "NextAuth Types"
Cohesion: 0.50
Nodes (3): JWT, Session, User

## Knowledge Gaps
- **229 isolated node(s):** `AnnouncementPageProps`, `Revision`, `Pagination`, `AuditLog`, `Pagination` (+224 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `Dev Dependencies & Config` to `Admin API & Site Context`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Production Dependencies` to `Dev Dependencies & Config`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **What connects `AnnouncementPageProps`, `Revision`, `Pagination` to the rest of the system?**
  _229 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin API & Site Context` be split into smaller, more focused modules?**
  _Cohesion score 0.058018018018018015 - nodes in this community are weakly interconnected._
- **Should `Announcements & Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.07673469387755102 - nodes in this community are weakly interconnected._
- **Should `Public Components & UI` be split into smaller, more focused modules?**
  _Cohesion score 0.0782051282051282 - nodes in this community are weakly interconnected._
- **Should `Admin Dashboard & Analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.07862903225806452 - nodes in this community are weakly interconnected._