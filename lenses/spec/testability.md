# Lens: testability

Can every acceptance criterion be checked by an observable test or command?

- Flag vague words ("fast", "handles errors", "works correctly"), criteria that can't fail, and criteria that bundle several checks.
- A `verify` target must isolate its criterion: running it executes only the test or check the criterion names, and it fails if that test does not exist. Flag a target that runs a whole suite, or a name filter that can match nothing and still exit 0.
- Every `verify` target must be concrete: a test path and name, or a command with an expected result. Check that referenced test files, commands and fixtures exist, or are plausible given the repo's test setup.
- Flag anything that can only be verified by a human looking at it, unless the spec says so explicitly.
