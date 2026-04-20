Feature: Cleanup reminder trigger gating
  As a user who enables cleanup reminders
  I want reminders to trigger only when recent media changed inside the configured scan range
  So that the app avoids noisy reminders when there is nothing new to scan

  Scenario: Recent media is newer than the latest scan
    Given cleanup reminders are enabled
    And the scan range is the last 3 months
    And the most recent eligible media is newer than the latest scan
    When the reminder trigger is evaluated
    Then the reminder should be eligible for scheduling

  Scenario: Recent media has not changed since the latest scan
    Given cleanup reminders are enabled
    And the scan range is the last 3 months
    And the most recent eligible media is not newer than the latest scan
    When the reminder trigger is evaluated
    Then the reminder should stay unscheduled

  Scenario: No recent scan exists yet but recent media is available
    Given cleanup reminders are enabled
    And the scan range is the last 6 months
    And the recent scan history is empty
    And at least one eligible media exists inside the scan range
    When the reminder trigger is evaluated
    Then the reminder should be eligible for scheduling
