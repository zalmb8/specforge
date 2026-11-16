# Lens: test quality

Do the tests prove the acceptance criteria, or merely exist?

- Each acceptance criterion's `verify` target must exist, be a real test or command, and be able to fail. A test that cannot fail, asserts nothing, or only checks that code ran is a finding.
- Tests should assert behavior, not mirror the implementation. A test that recomputes the expected value with the same logic as the code under test proves nothing.
- Cover the failure cases and edge cases the spec names, not just the happy path.
- Flag skipped, disabled or placeholder tests (for example a `test` script that is still `echo ok`), tests that depend on order, time, the network or shared state, and over-mocking that hides the thing being tested.
- Test names should make the criterion they cover obvious, and match the `verify` text exactly.
