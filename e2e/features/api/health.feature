@api
Feature: API Health and Root Discovery
  As an API consumer
  I want to check server health and discover available endpoints
  So that I can confirm the API is running and find resources

  Scenario: Health check returns OK
    When I send a GET request to "/health"
    Then the response status should be 200
    And the response body should have "status" equal to "ok"
    And the response body should have a "uptime" property
    And the response body should have a "timestamp" property

  Scenario: Root endpoint returns service metadata
    When I send a GET request to "/"
    Then the response status should be 200
    And the response body should have "service" equal to "CodeCohesion API"
    And the response body should have a "_links" property
    And the response body "_links" should have a "repos" property
    And the response body "_links" should have a "health" property
