# Refactor: extract duplicated validation into `src/validation.ts`

The fixture repository validates the same three values, with the same rules and the
same error messages, in `src/order.ts`, `src/cart.ts` and `src/checkout.ts`.

Extract the shared rules into a new module `src/validation.ts` exporting:

- `validateQuantity(value: number): void`
- `validatePrice(value: number): void`
- `validateEmail(value: string): void`

Rules that must not change:

- `validateQuantity` throws `new Error("quantity must be a positive integer")` unless the value
  is an integer greater than zero.
- `validatePrice` throws `new Error("price must be a non-negative number")` unless the value is a
  finite number greater than or equal to zero.
- `validateEmail` throws `new Error("email must contain @")` unless the value contains `@`.

Constraints:

- Do not change the error messages and do not change the public exports of the existing modules.
- The existing test files must keep passing without modification.
- Update `src/order.ts` to use the shared module and add `tests/validation.test.ts` covering the
  three error messages.
- Do not add dependencies, do not delete files, do not modify `package.json`.
- Report the list of created or modified files and the exact test output.
