# Simpler FitAdapt experience

The main journey is: create account → log in → choose goals → choose schedule → review → today's workout → save sets → finish → review progress.

Design decisions:
- Four consistent destinations on desktop and mobile: Hari ini, Jadual, Kemajuan, Akaun.
- One primary next action on the home screen; exercise lists and explanations are available on demand.
- Related setup questions are grouped into short steps; custom duration and back-navigation preserve choices.
- Light surfaces, readable text, labelled controls, visible keyboard focus and reduced motion support.
- Weekly progress comes from real saved workouts. Rest days and missed sessions use supportive messages.
- Workout controls explain repetitions, weight and effort; saved-set counts provide immediate feedback.
- Help remains available from the header. Historical records are reached through Kemajuan.

Validation: npm run build; npm run typecheck; npm test; node tests/auth-browser.js; node tests/user-journey-browser.js.
The journey test uses an isolated memory database and covers setup, custom duration, retained choices, saving and finishing a workout, help, navigation and viewport widths 375/768/1440.

For first-time usability testing, ask someone unfamiliar with FitAdapt to create an account, schedule a 25-minute workout, start it, save one set and find their history without coaching. Observe hesitation, wrong turns and task completion. Engagement improvements require observation of real users; this redesign does not claim a measured retention increase.
