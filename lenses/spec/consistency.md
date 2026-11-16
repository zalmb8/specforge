# Lens: consistency

Is the spec consistent with itself, with other specs, and with the answers it recorded?

- Read the other specs in the spec directory (including `done` ones). Flag overlap, contradiction, or work another spec already owns.
- Check `depends_on`: it must list every spec the prose says this one builds on or needs, and nothing it does not. Flag a prerequisite named in the text but missing from `depends_on`, and the reverse.
- Flag contradictions between Summary, Design, acceptance criteria and Out of scope.
- For every resolved open question (`- [x]`), check that its answer actually shows up in the Design or the acceptance criteria. A question ticked off while the spec text is unchanged is a finding.
- Flag terms used inconsistently, and acceptance criteria that no part of the Design supports.
