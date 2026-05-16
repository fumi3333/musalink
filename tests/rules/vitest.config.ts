import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/rules/**/*.test.ts"],
        testTimeout: 20_000,
        hookTimeout: 20_000,
        // Firestore emulator must be running on localhost:8080.
        // Start with: firebase emulators:start --only firestore
    },
});
