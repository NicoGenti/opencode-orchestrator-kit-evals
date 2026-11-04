# Bugfix: 1-based pagination returns the wrong slice

The fixture library exposes `paginate(items: readonly T[], page: number, pageSize: number): readonly T[]`
in `src/paginate.ts`. Pages are 1-based.

Observed behaviour: for `paginate([0,1,2,3,4,5,6], 2, 3)` the result is `[2,3,4]`, but the
documented contract requires `[3,4,5]`. The implementation starts every page one item early.

Required behaviour:

1. `page` is 1-based: page 1 returns `items[0]` through `items[pageSize - 1]`.
2. A page beyond the end of the array returns an empty array.
3. `pageSize < 1` throws a `RangeError`.

Constraints:

- Fix the root cause in `src/paginate.ts`; do not change the public signature.
- Do not add dependencies, do not modify `package.json` or `tsconfig.json`.
- Add `tests/paginate.test.ts` with a regression test for `paginate([0,1,2,3,4,5,6], 2, 3)` and
  a test for the page-beyond-end case.
- Report the root cause in one line, the list of modified files, and the exact test output.
