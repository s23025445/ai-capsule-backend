import express from "express";

import { getDatabase } from "../db/database.js";

const router = express.Router();

function optionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function toBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "yes";
}

function readCapsule(body = {}) {
  const capsule = {
    project_name: optionalText(body.project_name),
    prompt_title: optionalText(body.prompt_title),
    prompt_version: optionalText(body.prompt_version),
    prompt_text: optionalText(body.prompt_text),
    response_summary: optionalText(body.response_summary),
    category: optionalText(body.category),
    usefulness: optionalText(body.usefulness),
    reviewed: toBoolean(body.reviewed) ? 1 : 0,
    improved: toBoolean(body.improved) ? 1 : 0,
    screenshot_url: optionalText(body.screenshot_url),
    notes: optionalText(body.notes),
  };

  const missing = [];

  if (!capsule.project_name) missing.push("project_name");
  if (!capsule.prompt_title) missing.push("prompt_title");
  if (!capsule.prompt_text) missing.push("prompt_text");

  return { capsule, missing };
}

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/", (req, res) => {
  const db = getDatabase();
  const capsules = db
    .prepare("SELECT * FROM capsules WHERE user_id = ? ORDER BY created_at DESC, id DESC")
    .all(req.user.id);

  res.json({ capsules });
});

router.post("/", (req, res) => {
  const { capsule, missing } = readCapsule(req.body);

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
  }

  const db = getDatabase();
  const result = db
    .prepare(`
      INSERT INTO capsules (
        user_id,
        project_name,
        prompt_title,
        prompt_version,
        prompt_text,
        response_summary,
        category,
        usefulness,
        reviewed,
        improved,
        screenshot_url,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      req.user.id,
      capsule.project_name,
      capsule.prompt_title,
      capsule.prompt_version,
      capsule.prompt_text,
      capsule.response_summary,
      capsule.category,
      capsule.usefulness,
      capsule.reviewed,
      capsule.improved,
      capsule.screenshot_url,
      capsule.notes,
    );

  const created = db.prepare("SELECT * FROM capsules WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ capsule: created });
});

router.put("/:id", (req, res) => {
  const id = readId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "Capsule ID must be a positive number" });
  }

  const { capsule, missing } = readCapsule(req.body);

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
  }

  const db = getDatabase();
  const result = db
    .prepare(`
      UPDATE capsules
      SET
        project_name = ?,
        prompt_title = ?,
        prompt_version = ?,
        prompt_text = ?,
        response_summary = ?,
        category = ?,
        usefulness = ?,
        reviewed = ?,
        improved = ?,
        screenshot_url = ?,
        notes = ?
      WHERE id = ? AND user_id = ?
    `)
    .run(
      capsule.project_name,
      capsule.prompt_title,
      capsule.prompt_version,
      capsule.prompt_text,
      capsule.response_summary,
      capsule.category,
      capsule.usefulness,
      capsule.reviewed,
      capsule.improved,
      capsule.screenshot_url,
      capsule.notes,
      id,
      req.user.id,
    );

  if (result.changes === 0) {
    return res.status(404).json({ error: "Capsule not found" });
  }

  const updated = db.prepare("SELECT * FROM capsules WHERE id = ?").get(id);
  res.json({ capsule: updated });
});

router.delete("/:id", (req, res) => {
  const id = readId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "Capsule ID must be a positive number" });
  }

  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM capsules WHERE id = ? AND user_id = ?")
    .run(id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Capsule not found" });
  }

  res.status(204).end();
});

export default router;
