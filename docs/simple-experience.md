# FitAdapt experience

Current design: professional training studio with navy surfaces and violet accents. The light minimal direction has been replaced following user feedback.

User journey: register → log in → visual profile choices → schedule builder → real generated plan preview → confirm → dashboard → select workout → save sets → finish → progress.

The calendar planner, preview-before-save flow and structured profile layout change how users work with the system. The established training generator remains the source of exercise selection; its inputs are now explained. Progress includes workouts completed today.

Validation: npm run build; npm run typecheck; npm test; node tests/auth-browser.js; node tests/user-journey-browser.js.

Usability test: ask a first-time user to select a 25-minute routine, explain their plan, find the next workout, save one set, finish and locate their history. Observe task completion and hesitation without coaching. Engagement gains require real-user observation.
