/**
 * Upload a document to a Workfront Task and mirror it into the project Tasks folder.
 * Requires WORKFRONT_LIVE_SUBMIT=1 and confirmLive: true.
 */

"use strict";

const {
  readConfig,
  resolveAccessToken,
  authLabel,
  uploadMultipartToWorkfront,
  ensureProjectFolder,
  attachWorkfrontDocument,
} = require("../workfront-shared/client");

/** Keep under Vercel 4.5 MB body limit with JSON/base64 overhead. */
const MAX_RAW_BYTES = 3 * 1024 * 1024;

/**
 * @param {unknown} value
 */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, unknown>} body
 * @param {{ bearerToken?: string }} [options]
 */
async function runUploadDocument(env, body, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const config = readConfig(env);

  if (!config.liveSubmit) {
    return {
      statusCode: 403,
      headers,
      body: {
        ok: false,
        error:
          "Live submit is off. Set WORKFRONT_LIVE_SUBMIT=1 in .env.workfront.local and restart the proxy.",
      },
    };
  }
  if (body.confirmLive !== true) {
    return {
      statusCode: 400,
      headers,
      body: {
        ok: false,
        error: "confirmLive must be true before uploading documents.",
      },
    };
  }

  const taskId = text(body.taskId);
  const projectId = text(body.projectId) || config.projectId;
  const fileName = text(body.fileName) || "attachment.bin";
  const mimeType = text(body.mimeType) || "application/octet-stream";
  const base64Data = text(body.base64Data);

  if (!taskId) {
    return {
      statusCode: 400,
      headers,
      body: { ok: false, error: "taskId is required." },
    };
  }
  if (!projectId) {
    return {
      statusCode: 400,
      headers,
      body: { ok: false, error: "projectId is required." },
    };
  }
  if (projectId !== config.projectId) {
    return {
      statusCode: 400,
      headers,
      body: {
        ok: false,
        error: `projectId must match the configured queue project (${config.projectId}).`,
      },
    };
  }
  if (!base64Data) {
    return {
      statusCode: 400,
      headers,
      body: { ok: false, error: "base64Data is required." },
    };
  }

  let buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: { ok: false, error: "base64Data is not valid base64." },
    };
  }
  if (!buffer.length) {
    return {
      statusCode: 400,
      headers,
      body: { ok: false, error: "Decoded file is empty." },
    };
  }
  if (buffer.length > MAX_RAW_BYTES) {
    return {
      statusCode: 413,
      headers,
      body: {
        ok: false,
        error: `File exceeds ${MAX_RAW_BYTES} byte limit for proxy upload.`,
      },
    };
  }

  try {
    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });

    const { handle: taskHandle } = await uploadMultipartToWorkfront(
      config,
      token,
      fileName,
      mimeType,
      buffer,
    );
    const taskDoc = await attachWorkfrontDocument(config, token, {
      name: fileName,
      handle: taskHandle,
      docObjCode: "TASK",
      objID: taskId,
    });

    const folderID = await ensureProjectFolder(config, token, projectId, "Tasks");
    const { handle: projectHandle } = await uploadMultipartToWorkfront(
      config,
      token,
      fileName,
      mimeType,
      buffer,
    );
    const projectDoc = await attachWorkfrontDocument(config, token, {
      name: fileName,
      handle: projectHandle,
      docObjCode: "PROJ",
      objID: projectId,
      folderID,
    });

    return {
      statusCode: 201,
      headers,
      body: {
        ok: true,
        fileName,
        taskId,
        projectId,
        folderID,
        taskDocumentId: taskDoc.ID,
        projectDocumentId: projectDoc.ID,
        auth: authLabel(source),
        coverage:
          `Document attached to Task ${taskId} and project ${projectId} folder "Tasks" on mission-control-v1.`,
      },
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: {
        ok: false,
        error: error instanceof Error ? error.message : "Document upload failed.",
      },
    };
  }
}

module.exports = {
  runUploadDocument,
  MAX_RAW_BYTES,
};
