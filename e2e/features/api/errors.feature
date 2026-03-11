@api
Feature: API Error Handling
  As an API consumer
  I want to receive clear error responses
  So that I can understand and fix my requests

  Scenario: Non-existent repo returns 404
    When I send a GET request to "/api/repos/non-existent-repo-xyz/stats"
    Then the response status should be 404
    And the response body should have an "error" property
    And the response body should have a "code" property

  Scenario: Invalid hotspots limit returns 400
    Given I know the first repo ID
    When I send a GET request to "/api/repos/{repoId}/hotspots?limit=999"
    Then the response status should be 400
    And the response body should have "code" equal to "INVALID_PARAMETER"

  Scenario: Non-existent route returns 404
    When I send a GET request to "/api/does-not-exist"
    Then the response status should be 404
