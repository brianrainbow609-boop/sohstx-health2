# SohStx game design standards

Use the shared keyboard focus style on game entry pages. Keep controls usable by touch and keyboard, preserve the mobile viewport, and keep each game's art direction. Each Game Hub record needs a title, genre, card image, launch directory and install page.

Use canonical character names in UI, filenames and asset metadata. Record source-sheet aliases only in metadata. Add reusable artwork to the project sprite index and verify frame dimensions against its manifest.

Run `node games/shared/catalog.test.mjs` and `node games/shared/game-kit.test.mjs` before release. Rehearse the snapshot restore and offline browser checks with the Developer Console release command.