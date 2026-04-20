# BDD Specs

[中文版本](./bdd-specs.md)

## Feature 1: Team roles must be embedded into ongoing execution rules

### Scenario 1: Lead and sub-agent roles are explicit

- **Given** the repo enters a new execution wave
- **When** the Lead is about to split tasks and enable sub-agents
- **Then** the responsibilities of Bao Zheng, Gong Sun Ce, Zhan Zhao, the execution squad, and Ba Xian Wang must be declared first
- **And** every sub-member must have explicit file ownership and verification responsibility

### Scenario 2: The goal file is read-only

- **Given** the repo contains `docs/goal/v0.1.md`
- **When** any member advances a task
- **Then** the goal file may only be read and compared against
- **And** implementation pressure must not be used to rewrite the goal

## Feature 2: Runtime-touching work must end in a no-error state

### Scenario 3: Runtime issues take highest priority

- **Given** the current wave contains both runtime fixes and experience refinements
- **When** a runtime error appears
- **Then** all non-`P0` TODOs must be frozen
- **And** the team must finish the runtime root-cause fix and regression validation first

### Scenario 4: Minimum quality gates after runtime changes

- **Given** a runtime-sensitive path has changed
- **When** the team is about to declare completion
- **Then** `npm run typecheck -- --pretty false` must pass
- **And** `npm run test -- --run` must pass

## Feature 3: TODO work must advance through an explicit queue

### Scenario 5: Delivery blockers outrank experience refinement

- **Given** both recycle-bin data-flow gaps and interaction refinements exist
- **When** the Lead organizes the next TODO wave
- **Then** real recycle-bin data flow should enter execution before lower-priority experience work

### Scenario 6: Every TODO must include validation commands

- **Given** a TODO is placed into the execution queue
- **When** the team is about to start implementation
- **Then** the TODO must include an owner, dependencies, a BDD scenario, and validation commands
- **And** without validation commands it must not count as an executable item
