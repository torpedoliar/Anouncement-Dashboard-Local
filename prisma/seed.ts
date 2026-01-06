import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...");

    // Create default admin user
    const adminPassword = await hash("admin123", 12);
    const admin = await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: {},
        create: {
            email: "admin@example.com",
            passwordHash: adminPassword,
            name: "Administrator",
            role: "ADMIN",
        },
    });
    console.log("✅ Created admin user:", admin.email);

    // Create categories
    const categories = [
        { name: "News", slug: "news", color: "#ED1C24", order: 1 },
        { name: "Event", slug: "event", color: "#3B82F6", order: 2 },
        { name: "Career", slug: "career", color: "#10B981", order: 3 },
        { name: "Internal", slug: "internal", color: "#F59E0B", order: 4 },
    ];

    for (const cat of categories) {
        await prisma.category.upsert({
            where: { slug: cat.slug },
            update: cat,
            create: cat,
        });
    }
    console.log("✅ Created categories");

    // Create default settings
    await prisma.settings.upsert({
        where: { id: 1 },
        update: {},
        create: {
            siteName: "Santos Jaya Abadi",
            heroTitle: "Berita & Pengumuman",
            heroSubtitle: "Informasi terbaru dari perusahaan",
            primaryColor: "#ED1C24",
        },
    });
    console.log("✅ Created default settings");

    // Create sample announcements
    const newsCategory = await prisma.category.findUnique({ where: { slug: "news" } });
    const eventCategory = await prisma.category.findUnique({ where: { slug: "event" } });

    if (newsCategory && eventCategory) {
        const sampleAnnouncements = [
            {
                title: "Kapal Api Global Distribusikan Lebih dari 100 Produk ke 68 Negara",
                slug: "kapal-api-global-distribusi",
                excerpt: "PT Santos Jaya Abadi terus memperluas jangkauan distribusi produk kopi ke berbagai negara di dunia.",
                content: `<p>PT Santos Jaya Abadi, produsen kopi terbesar di Asia Tenggara, terus memperluas jangkauan distribusi produk kopi ke berbagai negara di dunia.</p>
        <p>Dengan lebih dari <strong>100 produk</strong> yang terdistribusi ke <strong>68 negara</strong>, Kapal Api Group membuktikan komitmennya dalam menyajikan kopi berkualitas tinggi ke seluruh dunia.</p>
        <h3>Produk Unggulan</h3>
        <ul>
          <li>Kapal Api Special</li>
          <li>ABC Susu</li>
          <li>Good Day</li>
          <li>Excelso</li>
        </ul>`,
                isHero: true,
                isPublished: true,
                isPinned: true,
                categoryId: newsCategory.id,
            },
            {
                title: "Program CSR: Pemberdayaan Petani Kopi Lokal",
                slug: "program-csr-petani-kopi",
                excerpt: "Inisiatif pemberdayaan petani kopi lokal sebagai bagian dari tanggung jawab sosial perusahaan.",
                content: `<p>Santos Jaya Abadi berkomitmen untuk mendukung kesejahteraan petani kopi lokal melalui berbagai program pemberdayaan.</p>
        <p>Program ini mencakup pelatihan teknik budidaya, bantuan bibit unggul, dan jaminan pembelian hasil panen.</p>`,
                isHero: false,
                isPublished: true,
                categoryId: newsCategory.id,
            },
            {
                title: "Coffee Festival 2024 - Save the Date!",
                slug: "coffee-festival-2024",
                excerpt: "Bergabunglah dalam perayaan kopi terbesar tahun ini bersama Kapal Api.",
                content: `<p>Kami dengan bangga mengumumkan Coffee Festival 2024 yang akan diselenggarakan pada bulan Juli mendatang.</p>
        <p>Festival ini akan menampilkan:</p>
        <ul>
          <li>Kompetisi barista</li>
          <li>Workshop brewing</li>
          <li>Cupping session</li>
          <li>Live music</li>
        </ul>`,
                isHero: true,
                isPublished: true,
                categoryId: eventCategory.id,
            },
        ];

        for (const announcement of sampleAnnouncements) {
            await prisma.announcement.upsert({
                where: { slug: announcement.slug },
                update: announcement,
                create: announcement,
            });
        }
        console.log("✅ Created sample announcements");
    }

    // Create default email settings (Internal SMTP)
    await prisma.emailSettings.upsert({
        where: { id: 1 },
        update: {},
        create: {
            smtpHost: "localhost",
            smtpPort: 25,
            smtpSecure: false,
            fromName: "Santos Jaya Abadi News",
            fromEmail: "news@santosjayaabadi.co.id",
            autoSendNewArticle: false,
        },
    });
    console.log("✅ Created default email settings");

    // Create email templates
    const emailTemplates = [
        {
            name: "Welcome Email",
            slug: "welcome",
            subject: "Selamat Datang di Newsletter {{siteName}}",
            type: "WELCOME" as const,
            htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Welcome</title></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px;">
<h1 style="color: #dc2626;">Selamat Datang, {{subscriberName}}!</h1>
<p>Terima kasih telah berlangganan newsletter {{siteName}}.</p>
<p>Anda akan menerima update terbaru tentang berita dan pengumuman dari kami.</p>
<hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
<p style="color: #888; font-size: 12px;">© {{year}} {{siteName}}. All rights reserved.</p>
</div>
</body>
</html>`,
            isActive: true,
        },
        {
            name: "New Article Notification",
            slug: "new-article",
            subject: "Artikel Baru: {{articleTitle}}",
            type: "NEW_ARTICLE" as const,
            htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Article</title></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px;">
<span style="background: {{categoryColor}}; color: #fff; padding: 4px 12px; font-size: 11px; font-weight: bold;">{{categoryName}}</span>
<h1 style="color: #1a1a1a; margin-top: 16px;">{{articleTitle}}</h1>
<p style="color: #666;">{{articleExcerpt}}</p>
<a href="{{articleUrl}}" style="display: inline-block; background: #dc2626; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">Baca Selengkapnya</a>
<hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
<p style="color: #888; font-size: 12px;">
<a href="{{unsubscribeUrl}}" style="color: #888;">Berhenti berlangganan</a>
</p>
</div>
</body>
</html>`,
            isActive: true,
        },
        {
            name: "Newsletter",
            slug: "newsletter",
            subject: "Newsletter {{siteName}} - {{date}}",
            type: "NEWSLETTER" as const,
            htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Newsletter</title></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden;">
<div style="background: linear-gradient(135deg, #1a1a1a, #0a0a0a); padding: 30px; text-align: center;">
<h1 style="color: #fff; margin: 0;">{{siteName}}</h1>
<p style="color: #888; margin: 10px 0 0;">Newsletter Mingguan</p>
</div>
<div style="padding: 30px;">
<h2 style="color: #1a1a1a;">Halo, {{subscriberName}}!</h2>
<p>Berikut adalah berita terbaru minggu ini:</p>
{{#each articles}}
<div style="border-bottom: 1px solid #eee; padding: 20px 0;">
<span style="background: {{this.categoryColor}}; color: #fff; padding: 2px 8px; font-size: 10px; font-weight: bold;">{{this.categoryName}}</span>
<h3 style="margin: 10px 0 5px;"><a href="{{this.url}}" style="color: #1a1a1a; text-decoration: none;">{{this.title}}</a></h3>
<p style="color: #666; margin: 0;">{{this.excerpt}}</p>
</div>
{{/each}}
</div>
<div style="background: #1a1a1a; padding: 20px; text-align: center;">
<p style="color: #888; font-size: 12px; margin: 0;">© {{year}} {{siteName}}</p>
<p style="margin: 10px 0 0;"><a href="{{unsubscribeUrl}}" style="color: #888; font-size: 11px;">Berhenti berlangganan</a></p>
</div>
</div>
</body>
</html>`,
            isActive: true,
        },
        {
            name: "Unsubscribe Confirmation",
            slug: "unsubscribe-confirm",
            subject: "Anda telah berhenti berlangganan",
            type: "UNSUBSCRIBE_CONFIRM" as const,
            htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; text-align: center;">
<h1 style="color: #1a1a1a;">Sampai Jumpa!</h1>
<p>Anda telah berhenti berlangganan dari newsletter {{siteName}}.</p>
<p style="color: #888;">Jika ini adalah kesalahan, Anda dapat berlangganan kembali kapan saja.</p>
</div>
</body>
</html>`,
            isActive: true,
        },
    ];

    for (const template of emailTemplates) {
        await prisma.emailTemplate.upsert({
            where: { slug: template.slug },
            update: template,
            create: template,
        });
    }
    console.log("✅ Created email templates");

    console.log("🎉 Database seeding completed!");
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
