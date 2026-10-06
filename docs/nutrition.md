# Nutrition Lab

Nutrition Lab keeps a private, dated food diary separate from the training profile. Users can estimate a daily energy guide, look up portions, log meals, edit or remove entries, and enter food-label values per 100 g. All interface copy supports Malay and English and existing light/dark themes.

Progress includes a 7-day or 30-day nutrition summary ending today (Malaysia time): days logged, average logged calories/macros, daily calorie bars and an accessible daily data table. Unlogged days remain null and are excluded from averages; partially logged days are explicitly identified as potentially incomplete. The current calorie guide is labelled separately and is not presented as a historical target. Profile displays nutrition measurements, goal, preferences and estimated guide; its edit dialog shares the Nutrition Lab profile without regenerating workouts or discarding unsaved workout-form fields.

## Data and estimates

The starter catalogue contains 30 foods from USDA FoodData Central SR Legacy (April 2018). Each item retains its FDC identifier, source description, preparation state, and source link. Rebuild it with `node scripts/import-nutrition-foods.js <extracted USDA CSV directory>`. Download: https://fdc.nal.usda.gov/download-datasets/ . No external API key is needed. It is not an exhaustive Malaysian food database. Users can enter their own labels or known recipes; unknown optional nutrients remain null and coverage is shown in daily totals.

Energy uses Mifflin–St Jeor resting energy multiplied by approximate activity factors (1.2, 1.375, 1.55, 1.725), then a general +300 / 0 / -300 kcal adjustment for gain / maintenance / loss. Rounded to 10 kcal. Macro guides allocate 20% protein, 50% carbohydrate, 30% fat. These are starting estimates, not individual prescriptions or predictions of weight change. Exercise calories are not added again.

The estimator is restricted to adults 18–78 who confirm they are not pregnant, breastfeeding, or following a medically prescribed diet. Weight-loss estimates are withheld below BMI 18.5, and estimates outside the app's general bounds are withheld. Food logging remains available without a nutrition profile. Dietary exclusions filter suggestions but cannot guarantee absence of allergens or cross-contact. Sources and limitations are available in the page's calculation details.

## Storage and verification

`nutrition_profiles` and `nutrition_entries` are additive tables. Standard migrations create them; authenticated nutrition requests also ensure the tables/index exist for upgrades of existing deployments. Entries store a source snapshot so later catalogue updates do not alter historical logs. All queries are scoped to the authenticated user, mutations require CSRF, and administrators cannot access this user-only API.

`npm test` includes equation, validation, portion, missing-data, privacy and CRUD checks through SQLite and libSQL. `node tests/nutrition-browser.js` checks the complete UI flow on an isolated in-memory database, including both languages/themes and phone/tablet/desktop widths.
