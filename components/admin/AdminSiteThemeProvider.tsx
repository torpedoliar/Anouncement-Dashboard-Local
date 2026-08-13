import { ReactNode } from "react";
import { resolveAdminSiteId } from "@/lib/site-context";
import prisma from "@/lib/prisma";
import SiteThemeProvider from "@/components/SiteThemeProvider";

export default async function AdminSiteThemeProvider({ children }: { children: ReactNode }) {
  const siteId = await resolveAdminSiteId();
  let primaryColor = "#ED1C24";
  let siteName = "Site";
  let siteSlug = "";

  if (siteId) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { name: true, slug: true, primaryColor: true },
    });
    if (site) {
      primaryColor = site.primaryColor || primaryColor;
      siteName = site.name;
      siteSlug = site.slug;
    }
  }

  return (
    <SiteThemeProvider primaryColor={primaryColor} siteName={siteName} siteSlug={siteSlug}>
      {children}
    </SiteThemeProvider>
  );
}