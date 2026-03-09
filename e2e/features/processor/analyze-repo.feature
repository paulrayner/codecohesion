@cli
Feature: Processor CLI Repository Analysis
  As a developer using CodeCohesion
  I want to analyze a git repository from the command line
  So that I can generate structured data for visualization

  Background:
    Given a test fixture repository exists

  Scenario: HEAD snapshot analysis
    When I run the processor CLI with the test repo
    Then the exit code should be 0
    And the output file should contain valid JSON
    And the JSON should have a "tree" property
    And the JSON should have a "stats" property
    And the stats should have "totalFiles" greater than 0
    And the stats should have "totalLoc" greater than 0
    And the stats should have a "filesByExtension" object

  Scenario: Timeline V1 analysis
    When I run the processor CLI with the test repo and "--timeline" flag
    Then the exit code should be 0
    And the output file should contain valid JSON
    And the JSON should have a "format" of "timeline-v1"
    And the JSON should have a "timeline" property
    And the JSON should have a "headSnapshot" property

  Scenario: Timeline V2 (full delta) analysis
    When I run the processor CLI with the test repo and "--full-delta" flag
    Then the exit code should be 0
    And the output file should contain valid JSON
    And the JSON should have a "format" of "timeline-v2"
    And the JSON should have a "commits" array with at least 1 entry
    And the JSON should have a "metadata" property

  Scenario: Coupling analysis from timeline V2
    Given a timeline V2 file has been generated for the test repo
    When I run the coupling CLI with the timeline V2 file
    Then the exit code should be 0
    And the coupling output file should contain valid JSON
    And the coupling JSON should have a "format" of "coupling-v1"
    And the coupling JSON should have an "edges" array
    And the coupling JSON should have a "clusters" array
