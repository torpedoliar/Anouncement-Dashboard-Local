import { checkAppHealth } from "../lib/portal-health";

async function runTests() {
    console.log("=== RUNNING PORTAL HEALTH MONITORING TESTS ===");

    // Test 1: Public reliable URL (HTTP 200 OK)
    const testAppOnline = {
        id: "test-app-1",
        name: "Test Online Service",
        url: "https://httpbin.org/status/200",
        loginUrl: null,
        healthStatus: "UNKNOWN",
    };

    console.log("Testing online endpoint (httpbin.org)...");
    try {
        const res1 = await checkAppHealth(testAppOnline);
        console.log("Test 1 Result:", {
            name: res1.appName,
            status: res1.status,
            statusCode: res1.statusCode,
            latencyMs: res1.latencyMs,
        });
        if (res1.status === "ONLINE" || res1.status === "DEGRADED") {
            console.log("✅ Test 1 PASSED: Online status and latency measured successfully!");
        } else {
            console.log("⚠️ Test 1 note:", res1.errorMessage);
        }
    } catch (e) {
        console.log("Test 1 skipped network:", e);
    }

    // Test 2: Offline / Non-existent host
    const testAppOffline = {
        id: "test-app-2",
        name: "Test Offline Server",
        url: "https://invalid-non-existent-domain-sja-123456.internal",
        loginUrl: null,
        healthStatus: "ONLINE",
    };

    console.log("Testing offline endpoint...");
    const res2 = await checkAppHealth(testAppOffline);
    console.log("Test 2 Result:", {
        name: res2.appName,
        status: res2.status,
        errorMessage: res2.errorMessage,
    });
    if (res2.status === "OFFLINE") {
        console.log("✅ Test 2 PASSED: Successfully detected OFFLINE server with error message!");
    } else {
        console.error("❌ Test 2 FAILED:", res2);
    }

    console.log("=== ALL HEALTH MONITORING TESTS COMPLETED ===");
}

runTests().catch(console.error);
