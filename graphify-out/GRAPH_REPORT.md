# Graph Report - E:/Vibe/Dashboard SJA/announcement-dashboard  (2026-07-27)

## Corpus Check
- 134 files · ~422,727 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 839 nodes · 1159 edges · 114 communities (71 shown, 43 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Revisions UI|Revisions UI]]
- [[_COMMUNITY_Dependencies|Dependencies]]
- [[_COMMUNITY_SSO Launch Page|SSO Launch Page]]
- [[_COMMUNITY_Announcement Edit|Announcement Edit]]
- [[_COMMUNITY_Bulk Actions API|Bulk Actions API]]
- [[_COMMUNITY_List API Routes|List API Routes]]
- [[_COMMUNITY_Core Stack|Core Stack]]
- [[_COMMUNITY_Portal Security|Portal Security]]
- [[_COMMUNITY_Form Handlers|Form Handlers]]
- [[_COMMUNITY_GET API Routes|GET API Routes]]
- [[_COMMUNITY_API List Routes|API List Routes]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_CRUD API Routes|CRUD API Routes]]
- [[_COMMUNITY_Admin Layout|Admin Layout]]
- [[_COMMUNITY_Site Layout|Site Layout]]
- [[_COMMUNITY_Users Management|Users Management]]
- [[_COMMUNITY_Page Metadata|Page Metadata]]
- [[_COMMUNITY_Article Page|Article Page]]
- [[_COMMUNITY_Design Quality|Design Quality]]
- [[_COMMUNITY_Delete API Routes|Delete API Routes]]
- [[_COMMUNITY_Delete API|Delete API]]
- [[_COMMUNITY_Search Page|Search Page]]
- [[_COMMUNITY_Utility Functions|Utility Functions]]
- [[_COMMUNITY_Analytics|Analytics]]
- [[_COMMUNITY_Site Context API|Site Context API]]
- [[_COMMUNITY_GETPOST API|GET/POST API]]
- [[_COMMUNITY_Email System|Email System]]
- [[_COMMUNITY_Announcements List|Announcements List]]
- [[_COMMUNITY_Admin Dashboard|Admin Dashboard]]
- [[_COMMUNITY_Category Filtering|Category Filtering]]
- [[_COMMUNITY_Site Pages|Site Pages]]
- [[_COMMUNITY_Announcement Display|Announcement Display]]
- [[_COMMUNITY_Mixed API|Mixed API]]
- [[_COMMUNITY_Global Settings|Global Settings]]
- [[_COMMUNITY_Footer Component|Footer Component]]
- [[_COMMUNITY_Master Plan|Master Plan]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 99|Community 99]]

## God Nodes (most connected - your core abstractions)
1. `logAudit()` - 63 edges
2. `authOptions` - 42 edges
3. `useConfirm()` - 23 edges
4. `validateInput()` - 19 edges
5. `formatZodErrors()` - 19 edges
6. `compilerOptions` - 16 edges
7. `validatePagination()` - 13 edges
8. `canAccessSite()` - 13 edges
9. `resolveAdminSiteId()` - 11 edges
10. `DQ-0 Token Unification` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ArticleHero()` --calls--> `calculateReadingTime()`  [INFERRED]
  components/site/ArticleHero.tsx → app/[slug]/page.tsx
- `GET()` --calls--> `logAudit()`  [EXTRACTED]
  app/api/backup/route.ts → lib/audit.ts
- `PUT()` --calls--> `logAudit()`  [EXTRACTED]
  app/api/email/settings/route.ts → lib/audit.ts
- `DELETE()` --calls--> `logAudit()`  [EXTRACTED]
  app/api/portal-apps/[id]/route.ts → lib/audit.ts
- `DELETE()` --calls--> `logAudit()`  [EXTRACTED]
  app/api/portal-groups/[id]/route.ts → lib/audit.ts

## Import Cycles
- None detected.

## Communities (114 total, 43 thin omitted)

### Community 0 - "Revisions UI"
Cohesion: 0.05
Nodes (42): Pagination, Revision, RevisionsPage(), CategoriesPage(), Category, Comment, CommentsPage(), Pagination (+34 more)

### Community 1 - "Dependencies"
Cohesion: 0.05
Nodes (40): dependencies, autoprefixer, bcryptjs, date-fns, dotenv, handlebars, isomorphic-dompurify, next (+32 more)

### Community 2 - "SSO Launch Page"
Cohesion: 0.07
Nodes (21): handler, PageProps, SsoLaunchPage(), PortalPage(), AccessDeniedProps, AppCardProps, CorruptCredentialProps, NoCredentialProps (+13 more)

### Community 3 - "Announcement Edit"
Cohesion: 0.07
Nodes (22): EditAnnouncementPage(), getAnnouncement(), getCategories(), getCategories(), NewAnnouncementPage(), AnnouncementFormProps, Category, MediaType (+14 more)

### Community 4 - "Bulk Actions API"
Cohesion: 0.10
Nodes (20): BulkAction, POST(), DELETE(), PUT(), DELETE(), PUT(), RouteParams, DELETE() (+12 more)

### Community 5 - "List API Routes"
Cohesion: 0.09
Nodes (17): DELETE(), RouteParams, AnnouncementCreateSchema, AnnouncementUpdateSchema, CategoryCreateSchema, CategoryUpdateSchema, NewsletterSubscribeSchema, PortalAppCreateSchema (+9 more)

### Community 6 - "Core Stack"
Cohesion: 0.08
Nodes (25): In-Memory IP Rate Limiting, NextAuth JWT Strategy, Next.js 15 App Router, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, postcss (+17 more)

### Community 7 - "Portal Security"
Cohesion: 0.09
Nodes (24): Account Lockout Mechanism, AES-256-GCM Credential Encryption, AES-256-GCM Encryption, Credential Data Structure, AES-256-GCM Confidentiality and Integrity, CSRF Token Handling, Extra Fields Mechanism, Fail-Closed on Invalid Key (+16 more)

### Community 8 - "Form Handlers"
Cohesion: 0.15
Nodes (15): POST(), POST(), POST(), PUT(), POST(), DELETE(), PUT(), RouteParams (+7 more)

### Community 9 - "GET API Routes"
Cohesion: 0.12
Nodes (8): handler, PATCH(), RouteParams, PUT(), PexelsPhoto, PexelsVideo, POST(), authOptions

### Community 10 - "API List Routes"
Cohesion: 0.21
Nodes (13): GET(), GET(), GET(), DELETE(), GET(), POST(), GET(), sendTemplatedEmail() (+5 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 12 - "CRUD API Routes"
Cohesion: 0.16
Nodes (10): PUT(), RouteParams, PUT(), RouteParams, canAccessSiteBySlug(), canAdminSite(), canEditOnSite(), getUserSiteRole() (+2 more)

### Community 13 - "Admin Layout"
Cohesion: 0.13
Nodes (6): AdminMainContent(), AdminMainContentProps, AdminSidebarProps, Site, SiteSelectorProps, UpdateInfo

### Community 14 - "Site Layout"
Cohesion: 0.13
Nodes (7): NavbarProps, NavLink, SiteTheme, SiteThemeContext, SiteThemeContextValue, SiteThemeProvider(), SiteThemeProviderProps

### Community 15 - "Users Management"
Cohesion: 0.13
Nodes (7): Site, User, Announcement, AnnouncementsListProps, Category, BulkActionBarProps, ConfirmDialogProps

### Community 16 - "Page Metadata"
Cohesion: 0.15
Nodes (9): inter, metadata, montserrat, NextAuthProvider(), Toast, ToastContext, ToastContextType, ToastProvider() (+1 more)

### Community 17 - "Article Page"
Cohesion: 0.15
Nodes (8): ArticlePage(), getArticleData(), PageProps, Comment, CommentCardProps, CommentSectionProps, ArticleHero(), ArticleHeroProps

### Community 18 - "Design Quality"
Cohesion: 0.18
Nodes (13): DQ-0 Token Unification, DQ-1 Accessibility P0, DQ-2 Feedback Primitives, DQ-3 Token Authority Migration, DQ-4 Strip AI-Slop Decoration, DQ-5 UX and Copy Unification, DQ-6 Minor Fixes and Perf, DQ-7 Final Verification (+5 more)

### Community 19 - "Delete API Routes"
Cohesion: 0.17
Nodes (5): PageProps, searchArticles(), SiteSearchPage(), globalForPrisma, prisma

### Community 20 - "Delete API"
Cohesion: 0.21
Nodes (9): DELETE(), GET(), IMAGE_TYPES, VIDEO_TYPES, GET(), HealthMetrics, HealthResponse, RouteParams (+1 more)

### Community 21 - "Search Page"
Cohesion: 0.23
Nodes (8): getSettings(), searchAnnouncements(), SearchPage(), SearchPageProps, AnnouncementCard(), AnnouncementCardProps, extractYoutubeId(), PaginationProps

### Community 22 - "Utility Functions"
Cohesion: 0.26
Nodes (8): calculateReadingTime(), countWords(), formatDateShort(), formatReadingTime(), generateExcerpt(), getRelativeTime(), stripHtml(), truncate()

### Community 23 - "Analytics"
Cohesion: 0.18
Nodes (5): AnalyticsData, AnalyticsSummary, CategoryDistribution, DailyView, TopArticle

### Community 24 - "Site Context API"
Cohesion: 0.25
Nodes (5): POST(), clearCurrentSite(), setCurrentSite(), SiteContext, USE_SECURE_COOKIE

### Community 25 - "GET/POST API"
Cohesion: 0.33
Nodes (7): GET(), POST(), createRevision(), CreateRevisionParams, getNextVersion(), getRevisionHistory(), restoreRevision()

### Community 26 - "Email System"
Cohesion: 0.33
Nodes (8): compileTemplate(), getSenderInfo(), getTransporter(), maybeSendNewArticleEmails(), sendBulkEmails(), sendEmail(), SendEmailParams, testConnection()

### Community 27 - "Announcements List"
Cohesion: 0.33
Nodes (6): AnnouncementsPage(), getAnnouncements(), getCategories(), GET(), getDefaultSite(), resolveAdminSiteId()

### Community 28 - "Admin Dashboard"
Cohesion: 0.39
Nodes (6): AdminDashboard(), getRecentAnnouncements(), getStats(), GET(), runScheduler(), SchedulerResult

### Community 29 - "Category Filtering"
Cohesion: 0.33
Nodes (6): getAnnouncements(), getCategories(), getHeroAnnouncements(), getSettings(), HomePage(), Category

### Community 30 - "Site Pages"
Cohesion: 0.29
Nodes (5): getSiteData(), PageProps, SiteHomePage(), FullscreenHeroProps, HeroAnnouncement

### Community 31 - "Announcement Display"
Cohesion: 0.43
Nodes (7): AnnouncementPage(), AnnouncementPageProps, calculateReadingTime(), getAnnouncement(), getCanonicalSitePath(), getRelatedAnnouncements(), getSettings()

### Community 32 - "Mixed API"
Cohesion: 0.43
Nodes (6): GET(), POST(), restoreById(), restoreLegacy(), stripDates(), withDates()

### Community 33 - "Global Settings"
Cohesion: 0.43
Nodes (5): getActiveSites(), getGlobalSettings(), SitePickerPage(), SitePickerCard(), SitePickerCardProps

### Community 34 - "Footer Component"
Cohesion: 0.29
Nodes (3): FooterProps, Settings, NewsletterSubscribeProps

### Community 35 - "Master Plan"
Cohesion: 0.29
Nodes (7): Master Implementation Plan v3.0.0, Phase 1 Foundation, Phase 2 Audit Trail, Phase 3 Admin Portal, Phase 4 Portal UX, Phase 5 SSO Launch, Phase 6 Integration and Hardening

### Community 36 - "Community 36"
Cohesion: 0.40
Nodes (5): ALLOWED_EXTENSIONS, ALLOWED_TYPES, POST(), sanitizeFilename(), UPLOAD_DIR

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (4): fs, path, prisma, { PrismaClient }

### Community 38 - "Community 38"
Cohesion: 0.60
Nodes (3): canModerateComment(), DELETE(), PUT()

### Community 39 - "Community 39"
Cohesion: 0.40
Nodes (3): DELETE(), RouteParams, PortalAppUpdateSchema

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (3): DELETE(), PUT(), RouteParams

### Community 41 - "Community 41"
Cohesion: 0.50
Nodes (4): extractYoutubeId(), HeroAnnouncement, HeroSection(), HeroSectionProps

### Community 42 - "Community 42"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (4): Announcement Model, AnnouncementSite Junction, Multi-Tenant Architecture, Site Model

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (3): ArticleVideoPlayer(), ArticleVideoPlayerProps, extractYoutubeId()

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): JWT, Session, User

## Knowledge Gaps
- **306 isolated node(s):** `handler`, `IMAGE_TYPES`, `VIDEO_TYPES`, `RouteParams`, `HealthMetrics` (+301 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Core Stack` to `Dependencies`, `Delete API Routes`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `prisma` connect `Delete API Routes` to `Core Stack`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `logAudit()` connect `Bulk Actions API` to `Mixed API`, `SSO Launch Page`, `List API Routes`, `Community 38`, `Community 39`, `Form Handlers`, `GET API Routes`, `Community 40`, `Community 48`, `Admin Dashboard`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `handler`, `IMAGE_TYPES`, `VIDEO_TYPES` to the rest of the system?**
  _311 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Revisions UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05064935064935065 - nodes in this community are weakly interconnected._
- **Should `Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `SSO Launch Page` be split into smaller, more focused modules?**
  _Cohesion score 0.07422402159244265 - nodes in this community are weakly interconnected._