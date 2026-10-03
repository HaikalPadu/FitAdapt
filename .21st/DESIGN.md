# FitAdapt training studio

## Visual direction
Deep navy surfaces, lavender actions, subtle violet feature panels and consistent 20px corners. Dashboard rows share aligned edges and heights. Choice groups fill equal columns; mobile layouts stack or condense without horizontal page overflow. Keep visible labels, keyboard focus and reduced-motion support.

## Experience
- Account creation still leads to login before onboarding.
- Plan Studio uses visual cards for goals, experience and equipment, then a schedule builder with custom duration and shortcuts.
- Preview calls the same server generator used to save plans, returning two weeks without creating a profile or plan. Confirmation saves the plan.
- Dashboard combines today's workout, a weekly completion ring, seven-day calendar, exercise list and training profile.
- Planner uses selectable dates and a focused session panel instead of a long feed. Explain the actual generator inputs: days, duration, equipment, experience, limitations and recovery.
- Profile uses a member summary alongside grouped training settings and account security.
- Progress includes completed sessions from today. Do not display invented achievements, metrics or retention claims.

## Implementation
Reuse existing React form controls, SVG icons, dialogs, API validation and training generator. No new dependencies or database migrations. External context-aware reference search was blocked; no repository context was uploaded.

## Verification
Build, TypeScript, 32 backend tests on SQLite/Turso, authentication browser tests, full first-time browser journey at 375/768/1440 widths. Preview tests cover authorization, CSRF, invalid input, no writes and agreement with saved-plan exercise selection. Visual screenshots checked for desktop dashboard, onboarding, preview, login and mobile planner.
