# 中文版本: ./scan-runtime-cache-reminder.feature

Feature: Runtime stability, analysis cache, and reminder gating
  In order to keep photo cleanup stable and efficient
  As a user
  I want the app to define verifiable behavior for detail closing, repeated analysis, UI responsiveness, and scheduled reminders

  Scenario: Closing a playing video detail view does not trigger a runtime crash
    Given the user is playing a video in the detail viewer
    When the user taps the close button
    Then the detail viewer closes normally
    And the player teardown must not trigger an extra pause call or another runtime exception

  Scenario: Previously analyzed unchanged media reuses persisted local analysis cache
    Given the user has already completed a scan before
    And the app has persisted local media analysis results
    When the user scans the same unchanged media set again
    Then the system should reuse the matching local analysis cache first
    And it should not regenerate reduced previews or recalculate the same media fingerprint again

  Scenario: Scan analysis does not block main-thread rendering for long stretches
    Given the user starts scanning recent media
    When image and video analysis is running
    Then the main thread should remain responsive
    And analysis should run through a worker or another cooperative chunking strategy that yields back to rendering

  Scenario: Reminders fire only when new media exists inside the configured recent scan range
    Given the user has enabled scheduled scan reminders
    And the scan range is set to the last 3 months
    When the system detects new photos or videos within the last 3 months
    Then the reminder becomes eligible to fire
    And if there is no new media within the last 3 months the reminder should not fire

  Scenario: The current live app entry reconciles enabled reminders on cold start
    Given the user has already enabled scheduled scan reminders in settings
    And the current app enters through App.tsx into the main navigator
    When the app cold starts and restores local reminder settings
    Then the system should reconcile reminders from the current live entry path
    And any changed reminder metadata should be persisted locally
