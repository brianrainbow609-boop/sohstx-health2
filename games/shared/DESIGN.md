# SohStx game design standards

Use the shared keyboard focus style on game entry pages. Keep controls usable by touch and keyboard, preserve the mobile viewport, and keep each game's art direction. Each Game Hub record needs a title, genre, card image, launch directory and install page.

Use canonical character names in UI, filenames and asset metadata. Record source-sheet aliases only in metadata. Add reusable artwork to the project sprite index and verify frame dimensions against its manifest.

Run `node games/shared/catalog.test.mjs` and `node games/shared/game-kit.test.mjs` before release. Rehearse the snapshot restore and offline browser checks with the Developer Console release command.

## Disabled local game economy

Use createGameEconomy from the shared game kit for the shared local earned-currency balance and per-game points. The exported GAME_ECONOMY_ENABLED flag is false by default; no game UI or game page should enable it until a separately reviewed release. Economy state uses its own sohstx-economy-* storage key and must never overwrite existing sohstx-game-* saves. All earning and spending operations require idempotency keys; spending requires a named sink and cannot create a negative balance. Currency is earned only from game events. Do not add purchase, checkout, real-money conversion, premium-game entitlement, or monetization-channel integration. Keep monetization disabled and test migrations and storage failures before release.
