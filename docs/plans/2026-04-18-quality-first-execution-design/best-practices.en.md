# Best Practices

[中文版本](./best-practices.md)

## 1. Role Usage

1. The Lead does not outsource critical blocking work.
2. Sub-members only take bounded, independently verifiable tasks.
3. The accepter does not rewrite implementation; gaps are reported back to the Lead for a decision.

## 2. Runtime Fixes

1. Add the failing scenario first, then fix the implementation.
2. Inspect the live path before the legacy path.
3. Do not hide lifecycle or resource-release root causes behind `try/catch`.
4. Do not keep advancing experience work while runtime is still unresolved.

## 3. Test Discipline

1. Run targeted validation first, then full validation.
2. New logic must come with tests.
3. If something cannot be tested, the reason and an alternate acceptance method must be stated.

## 4. TODO Sequencing

1. `P0` comes before `P1/P2/P3`.
2. Blocking items must be listed explicitly on the plan index.
3. Every TODO needs at least one acceptance command.

## 5. Documentation Discipline

1. Standards and design docs are Chinese-first with English mirrors.
2. Plans may stay Chinese-only, but they must reference the relevant design and standards.
3. Documentation changes must stay synchronized with the current code state.
