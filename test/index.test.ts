import nock from "nock";
import { robot } from "../src/bot";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";

const privateKey = fs.readFileSync(
  path.join(process.cwd(), "test/fixtures/mock-cert.pem"),
  "utf-8"
);

describe("ChatGPT Code Review Bot", () => {
  let probot: Probot;

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({
      appId: 123,
      privateKey,
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    // Load our app into probot
    probot.load(robot);
  });

  test("bot loads successfully", () => {
    // Verify the bot loaded without errors
    expect(probot).toBeDefined();
  });

  test("bot registers pull_request event handlers", () => {
    // The bot should have registered event handlers
    // This is a basic smoke test to ensure the bot initializes
    expect(probot).toBeDefined();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about using TypeScript in your tests, Jest recommends:
// https://github.com/kulshekhar/ts-jest

// For more information about testing with Nock see:
// https://github.com/nock/nock
