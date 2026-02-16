
try {
    require('./lib/index.js');
    console.log("Loaded successfully");
} catch (e) {
    console.error("Failed to load:", e);
}
