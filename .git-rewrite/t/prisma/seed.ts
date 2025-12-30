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
