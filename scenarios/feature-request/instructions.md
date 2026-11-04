# Feature request: add `slugify`

Implement `slugify(input: string): string` in `src/slug.ts` of the fixture repository.

Rules, applied in this order:

1. Convert the input to lower case.
2. Replace every run of characters outside `[a-z0-9]` with a single `-`.
3. Remove leading and trailing `-`.
4. Return an empty string when the input contains no `[a-z0-9]` character.

Examples:

- `"Hello World"` returns `"hello-world"`
- `"  A--B  "` returns `"a-b"`
- `"!!!"` returns `""`

Constraints:

- Do not add dependencies and do not modify `package.json`.
- Add `tests/slug.test.ts` covering the three examples above.
- Run the fixture test command and report its exact output.
- Report the list of files you created or modified.
