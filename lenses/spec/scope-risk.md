# Lens: scope and risk

Is the scope bounded and the risk visible?

- Flag hidden work, unstated dependencies, and anything a builder could reasonably read two ways.
- Look at the code the spec would touch for coupling or blast radius the spec doesn't mention.
- Flag risky or irreversible changes (data migrations, public API changes, deletions) that lack a stated rollback or safeguard.
- Check that "Out of scope" is real: does it exclude things a builder would otherwise assume are included?
