# Lens: resiliency

How does this code behave when things go wrong?

- Failure paths: errors swallowed, errors that leave partial state, missing timeouts, retries without limits or backoff, unbounded loops or growth.
- Data safety: non-atomic writes, operations that are not idempotent where they will be repeated, no validation of untrusted input, data loss on a crash halfway through.
- Resources: files, connections, processes and temp files that are not cleaned up on every path.
- Concurrency: shared state, ordering assumptions, check-then-act races.
- Compatibility: changes that break existing callers, stored data or configs with no migration or fallback.
- Diagnosability: a failure should leave enough in the error message or log to understand what happened, without leaking secrets.
