@api
Feature: API Repository Endpoints
  As an API consumer
  I want to query repository data
  So that I can analyze code structure and metrics

  Scenario: List all repositories
    When I send a GET request to "/api/repos"
    Then the response status should be 200
    And the response body should have a "repos" array
    And the repos array should have at least 1 entry
    And each repo should have "id" and "name" properties

  Scenario: Get repository stats
    Given I know the first repo ID
    When I send a GET request to "/api/repos/{repoId}/stats"
    Then the response status should be 200
    And the response body should have a "stats" property
    And the response stats should have "totalFiles" greater than 0
    And the response stats should have "totalLoc" greater than 0

  Scenario: Get repository contributors
    Given I know the first repo ID
    When I send a GET request to "/api/repos/{repoId}/contributors"
    Then the response status should be 200
    And the response body should have a "contributors" array

  Scenario: Get repository files
    Given I know the first repo ID
    When I send a GET request to "/api/repos/{repoId}/files"
    Then the response status should be 200
    And the response body should have a "files" array
    And the response body should have "total" greater than 0

  Scenario: Get repository hotspots
    Given I know the first repo ID
    When I send a GET request to "/api/repos/{repoId}/hotspots"
    Then the response status should be 200
    And the response body should have a "topChurn" array
    And the response body should have a "topContributors" array
