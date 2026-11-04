import { describe, expect, test } from "bun:test";
import {
  FORBIDDEN_ACTION_VOCABULARY,
  listScenarioIds,
  loadConstraints,
  loadInstructions,
  loadScenario,
} from "../scripts/lib/scenario.ts";

describe("scenario definitions", () => {
  test("exposes exactly the three initial scenarios in alphabetical order", () => {
    expect(listScenarioIds()).toEqual(["bugfix", "feature-request", "refactor"]);
  });

  for (const id of listScenarioIds()) {
    test(`"${id}" is complete and consistent`, () => {
      const scenario = loadScenario(id);
      expect(scenario.id).toBe(id);
      expect(scenario.description.length).toBeGreaterThan(0);
      expect(scenario.repositoryFixture).toBe(`fixtures/${id}`);
      expect(scenario.fixtureStatus).toBe("placeholder");
      expect(scenario.timeoutSeconds).toBeGreaterThan(0);
      expect(scenario.expectedArtifacts.length).toBeGreaterThan(0);

      const constraints = loadConstraints(scenario);
      expect(constraints.scenario).toBe(id);
      expect(constraints.requiredFiles.length).toBeGreaterThan(0);
      expect(constraints.maximumToolCalls).toBeGreaterThan(0);
      expect(constraints.requiredOutputFormat.length).toBeGreaterThan(0);
      for (const action of constraints.forbiddenActions) {
        expect(FORBIDDEN_ACTION_VOCABULARY).toContain(action);
      }

      expect(loadInstructions(scenario).length).toBeGreaterThan(80);
    });
  }

  test("rejects an unknown scenario", () => {
    expect(() => loadScenario("unknown-scenario")).toThrow();
  });
});
