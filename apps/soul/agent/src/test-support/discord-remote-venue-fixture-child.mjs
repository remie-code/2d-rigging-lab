const port = process.argv[process.argv.indexOf("--port") + 1];
process.argv = [process.argv[0], process.argv[1], "serve", process.env.SOUL_VENUE_FIXTURE_ROOT, port];
await import("./discord-remote-venue-fixture.mjs");
