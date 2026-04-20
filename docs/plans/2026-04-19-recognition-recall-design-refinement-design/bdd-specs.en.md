# BDD Specs

[中文版本](./bdd-specs.md)

## Recognition Recall

```gherkin
Feature: Recognition recall improvement

  Scenario: Moderately blurry and dim photos should still be detected
    Given the library contains a dim and visibly blurry photo
    When the user runs a scan
    Then the photo should appear in candidate results
    And its reasons should include blur, dimness, or low quality

  Scenario: Flat-color or near-flat-color images should be detected
    Given the library contains an image with near-flat color and very low edge content
    When the user runs a scan
    Then the image should appear in candidate results

  Scenario: Two identical photos should form one duplicate group
    Given the library contains two identical photos
    When the user runs a scan
    Then the system should build one duplicate group
    And the grid count should match the detail-stage group size

  Scenario: A fallback analysis should not permanently block duplicate detection
    Given one of two identical photos falls back during first analysis
    When the system evaluates duplicates
    Then the system should retry or degrade gracefully
    And it should not abandon duplicate detection after one fallback

  Scenario: Similar but not fully duplicate photos should form a similar group
    Given the library contains two visually similar but not identical photos
    When the user runs a scan
    Then the system should surface them in a similar-media result layer
```

## Count Semantics

```gherkin
Feature: Unified duplicate count semantics

  Scenario: Grid count represents group size
    Given a result belongs to a duplicate group
    When the user inspects the grid badge
    Then the count should represent the browsable group size

  Scenario: Detail pagination matches the list count
    Given the user opens a duplicate result from the grid
    When the user browses the detail stage
    Then the number of browsable items should align with the grid count semantics
```

## Design Refinement

```gherkin
Feature: Scan and detail refinement

  Scenario: Scan entry and progress are merged into one card
    Given the user has granted permission
    When the scan is idle, running, and completed
    Then the page should keep a single-card structure
    And completion should not introduce a separate result card

  Scenario: The detail page keeps one media stage and minimal secondary content
    Given the user opens the detail view
    Then the media stage should dominate the layout
    And tags should be capped to the latest three on one row
    And actions, dots, and tags should have clear hierarchy

  Scenario: Scan animation should be smooth and flicker-free
    Given scan candidates disappear gradually
    Then the page should use one primary transition
    And tab counts should update without jumpy flicker
```

