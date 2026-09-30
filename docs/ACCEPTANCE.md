# Acceptance checks

## Automated results

`npm test`: **29 tests passing** on 30 September 2026.

| Coverage | Verification |
| --- | --- |
| T1–T4, T8 | Increase, hold, reduction, plateau and weekly load-change cap |
| T5–T7 | Safe reschedule, carry-over and reduced volume |
| T9–T10 | 2–6 day splits and Malay limitation filtering |
| T11 | API rejects edits after the 24-hour window |
| T12–T13 | Admin self-protection and exercise deletion prevention |
| T14 | 23 completed / 28 elapsed sessions = 82% |
| Authentication | Register/login, CSRF rejection, suspension revokes existing sessions |
| Privacy | Users cannot read other users' logs; admins cannot read user logs |
| Integrity | Account deletion cascades, profile changes preserve today/past, only future load targets change |
| Scheduling | Reconciliation is idempotent and extends two weeks ahead |
| Turso/libSQL | Real client, schema, seed, transactions, rollback, FK cascades and full API lifecycle |

`npm run test:e2e`: **passed** using headless Microsoft Edge.

- Desktop landing, user dashboard, plans, logs, progress, profile, feedback and all admin pages load without JavaScript errors.
- A newly registered account completes all four onboarding steps, starts today's workout, saves a set/RPE, finishes, and retains its log after a page reload.
- Feedback submission shows its acknowledgement screen.
- Dashboard, plan, progress and profile have no horizontal document overflow at 390 px.
- Desktop and mobile screenshots are generated in `test-results/` and inspected visually.
- Browser-created workout account is deleted after the test; seed-user feedback entries remain as test records.

## Manual demonstration

1. Open http://127.0.0.1:3000, register, and select two or three training days including today.
2. Complete onboarding and open the plan. View an exercise's instructions and alternatives.
3. Start today's session. Enter rep, weight and RPE, then mark a set complete. The set saves immediately and starts the rest timer.
4. Finish the session. Reopen its log, edit within the allowed window and inspect the progress graph.
5. Change the equipment or training days in Profile. Today's session stays intact; the new plan starts tomorrow.
6. Submit feedback. Log in with `admin@fitadapt.com` using the seed password from `.env`; inspect feedback and export CSV.
7. Add/edit/deactivate/reactivate an exercise. Suspend a test account and confirm its existing login is revoked.

## Remaining deployment checks

- Provide Turso URL/auth token, migrate and seed the dedicated cloud database, and verify `/api/health` reports `turso`.
- Cloud connectivity and network latency remain untested without credentials.
- Measure the specification's 4G load and API latency targets against the chosen deployment region.
- Conduct the student usability study and review exercise instruction content with the project supervisor.
- Configure HTTPS, hosting secrets, backup policy, exact reverse-proxy trust and operator-specific legal content for public deployment.

Coach interfaces, email password reset and push/email notifications remain intentionally deferred by the original MVP specification.
