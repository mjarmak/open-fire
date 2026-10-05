# Landing-page demo

This separate Angular entry point reuses real app components and substitutes an in-memory API store. It never loads the production bootstrap. Unsupported API actions return a demo error; they are never forwarded to a backend. Browser storage is replaced with per-frame memory and IndexedDB audio databases use a demo namespace. Reset reloads the frame.

`npm run build` builds the normal app and packages the production-optimized demo at `/demo/index.html`. Existing Angular build flags still apply to the normal build. `npm run build:demo` rebuilds just the demo. Hash routing lets each viewport select a workflow without server routes. Analytics, login, service workers, notifications and restaurant bridge connections are disabled in the demo.

Deploy the app build before publishing a landing page that embeds its demo. Serve the demo directory as static files. Preview locally with a static server; the landing repository's localhost-only `?demoPreview=local` mapping uses ports 4306 (Remixer), 4307 (Order), and 4308 (Fire). The app URL remains the approved HTTPS URL on public hosts.

The demo has no server, database migration, real AI generation or user-account mutation. Changes to reused app components are picked up during ordinary app builds; changes to their API contracts may require corresponding fixture updates here. Verify the promoted workflows, reset behavior, production authentication and mobile sizes before release.
