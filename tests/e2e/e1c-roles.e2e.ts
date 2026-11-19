import { test } from "./helpers";
import { roleTests, superadminTest } from "./e1c-roles-core";

test.describe("E1-C staff roles", () => {
  superadminTest();
  roleTests(["moderator", "content_editor", "support", "finance"]);
});
