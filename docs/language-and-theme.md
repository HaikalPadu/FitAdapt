# Language and appearance

The toolbar on every page offers Bahasa Melayu / English and Dark / Light. The mandatory setup dialog has its own copy of these controls because native dialogs make the background inaccessible. Choices are stored in this browser under `fitadapt_language` and `fitadapt_theme`; they are independent of the login session and are not account preferences shared between devices.

`public/js/preferences.js` applies the theme before styles load. It provides translation helpers and dispatches `fitadapt:preferences`. React subscribes through `lib/preferences.ts`, preserving the authentication form and animation state. The legacy application rebuilds its labels while retaining form drafts, the selected exercise, calendar selection, and rest timer. No preference change submits a form or regenerates a plan.

Add authored interface phrases to `public/js/translations.js` and wrap source literals with `i18n(...)` or an `i18n` tagged template in the legacy app, and `t(...)` in React. Tagged templates translate only their static parts. Escape dynamic HTML values with `esc` as before. Never pass assembled HTML, names, notes, or feedback through the translator.

Known server messages and generated workout labels use `systemText`, backed by an explicit allowlist. Unknown catalogue instructions remain in their original language. Exercise names retain their catalogue names. The exercise editor always edits original stored instructions. Standard validation messages use the request’s language without changing Zod’s global locale.

Light appearance tokens and component overrides live in `public/css/preferences.css`. Keep the original dark studio palette and check forms, status badges, charts, dialogs and the React authentication card when adding a component.

Verification: `npm test`, `npm run build`, `npm run typecheck`, `npm run test:preferences-browser`, and `node tests/user-journey-browser.js`. Browser tests use an isolated in-memory database and Microsoft Edge.
