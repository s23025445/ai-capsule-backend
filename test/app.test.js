import assert from "node:assert/strict";
import { after, test } from "node:test";
import jwt from "jsonwebtoken";
import request from "supertest";

// Tests get a fresh in-memory database and never touch the real local file.
process.env.NODE_ENV = "test";
process.env.DATABASE_FILE = ":memory:";
process.env.JWT_SECRET = "test-only-secret";
process.env.FRONTEND_URL = "http://localhost:3000";

// Dynamic imports happen after the test environment is ready.
const { default: app } = await import("../app.js");
const { closeDatabase } = await import("../db/database.js");

after(() => {
  closeDatabase();
});

function cookieFor(userId) {
  const token = jwt.sign({ username: userId }, process.env.JWT_SECRET, {
    subject: userId,
    expiresIn: "1h",
  });

  return `token=${token}`;
}

test("health check stays public", async () => {
  const response = await request(app).get("/api/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("capsules reject missing and fake JWTs", async () => {
  const missing = await request(app).get("/api/capsules");
  const fake = await request(app).get("/api/capsules").set("Cookie", "token=fake-token-123");

  assert.equal(missing.status, 401);
  assert.equal(fake.status, 401);
});

test("a user can manage their own capsule but another user cannot", async () => {
  const ownerCookie = cookieFor("user-1");
  const otherCookie = cookieFor("user-2");

  const created = await request(app)
    .post("/api/capsules")
    .set("Cookie", ownerCookie)
    .send({
      user_id: "someone-else",
      project_name: "AI Capsule",
      prompt_title: "First prompt",
      prompt_text: "Explain this code",
      reviewed: true,
    });

  assert.equal(created.status, 201);
  assert.equal(created.body.capsule.user_id, "user-1");

  const capsuleId = created.body.capsule.id;
  const ownerList = await request(app).get("/api/capsules").set("Cookie", ownerCookie);
  const otherList = await request(app).get("/api/capsules").set("Cookie", otherCookie);

  assert.equal(ownerList.body.capsules.length, 1);
  assert.equal(otherList.body.capsules.length, 0);

  const blockedUpdate = await request(app)
    .put(`/api/capsules/${capsuleId}`)
    .set("Cookie", otherCookie)
    .send({
      project_name: "Changed by someone else",
      prompt_title: "Not allowed",
      prompt_text: "This must not work",
    });

  assert.equal(blockedUpdate.status, 404);

  const updated = await request(app)
    .put(`/api/capsules/${capsuleId}`)
    .set("Cookie", ownerCookie)
    .send({
      project_name: "AI Capsule",
      prompt_title: "Improved prompt",
      prompt_text: "Explain this code simply",
      improved: true,
    });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.capsule.prompt_title, "Improved prompt");

  const blockedDelete = await request(app)
    .delete(`/api/capsules/${capsuleId}`)
    .set("Cookie", otherCookie);

  assert.equal(blockedDelete.status, 404);

  const deleted = await request(app)
    .delete(`/api/capsules/${capsuleId}`)
    .set("Cookie", ownerCookie);

  assert.equal(deleted.status, 204);
});
