
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSessionValidation() {
    console.log("1. Finding an active session...");
    const session = await prisma.userSession.findFirst({
        where: { isRevoked: false, expiresAt: { gt: new Date() } },
        include: { user: true }
    });

    if (!session) {
        console.log("No active session found. Please login closer to run this test.");
        return;
    }

    console.log(`Found session for user: ${session.user.name} (Token: ${session.sessionToken})`);

    console.log("2. Revoking session in database...");
    await prisma.userSession.update({
        where: { id: session.id },
        data: { isRevoked: true }
    });
    console.log("Session marked as revoked.");

    console.log("3. NOTE: In a real scenario, we would now try to use the JWT cookie.");
    console.log("   Since we cannot simulate a full browser request easily here without the cookie value,");
    console.log("   this script serves to prepare the DB state for manual verification.");
    console.log("   Please try to refresh the page in your browser. If you are still logged in, the fix is NOT working.");
    console.log("   If you are logged out, the fix IS working.");

    // Restore session for now so we don't annoy the user potentially? 
    // Actually, we want to test the fix, so let's keep it revoked or ask user to create a text user?
    // Let's just create a dummy session to simulate the logic if we could, but checking via browser is best.
}

testSessionValidation()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
