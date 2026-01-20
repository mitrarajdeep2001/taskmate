import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { humanFileSize, smallId } from "../shared/utils";
import { getStorageUrl } from "../shared/constants";
import { ServerResponse } from "../models/server-response";
import {
  createCloudinaryPresignedUrl,
  createPresignedUrlWithClient,
  deleteFileFromCloudinary,
  deleteObject,
  getAvatarKey,
  getKey,
  getRootDir,
  uploadBase64,
  uploadBuffer,
  uploadToCloudinary,
} from "../shared/storage";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class AttachmentController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async createTaskAttachment(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { buffer, file_name, task_id, project_id, size, type } = req.body;

    // 1️⃣ Insert DB row first (without URL) to get ID
    const insertQuery = `
    INSERT INTO task_attachments (
      name,
      task_id,
      team_id,
      project_id,
      uploaded_by,
      size,
      type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, name, size, type, created_at;
  `;

    const insertResult = await db.query(insertQuery, [
      file_name,
      task_id,
      req.user?.team_id,
      project_id,
      req.user?.id,
      size,
      type,
    ]);

    const [data] = insertResult.rows;

    if (!data?.id) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Attachment upload failed"));
    }

    // 2️⃣ Upload to Cloudinary using DB-generated ID
    const uploadResult = await uploadToCloudinary(buffer as Buffer, {
      folder: "task_mate/task_media",
      publicId: `task_${data.id}`,
    });

    if (!uploadResult?.secure_url) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Attachment upload failed"));
    }

    // 3️⃣ Update DB row with Cloudinary URL
    const updateQuery = `
    UPDATE task_attachments
    SET url = $2
    WHERE id = $1
    RETURNING url;
  `;

    const updateResult = await db.query(updateQuery, [
      data.id,
      uploadResult.secure_url,
    ]);

    if (!updateResult.rowCount) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Attachment upload failed"));
    }

    // 4️⃣ Respond
    return res.status(200).send(
      new ServerResponse(true, {
        ...data,
        url: uploadResult.secure_url,
        size: humanFileSize(data.size),
      }),
    );
  }

  @HandleExceptions()
  public static async createAvatarAttachment(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { buffer } = req.body;

    if (!buffer) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Avatar upload failed"));
    }

    try {
      const result = await uploadToCloudinary(buffer as Buffer, {
        folder: "task_mate/avatars",
        publicId: `avatar_${req.user?.id}`, // 👈 overwrite per user
      });

      const avatarUrl = `${result.secure_url}?v=${smallId(4)}`;

      const q = `
      UPDATE users
      SET avatar_url = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING avatar_url;
    `;

      const dbResult = await db.query(q, [req.user?.id, avatarUrl]);
      const [data] = dbResult.rows;

      if (!data) {
        return res
          .status(200)
          .send(new ServerResponse(false, null, "Avatar upload failed"));
      }

      return res
        .status(200)
        .send(
          new ServerResponse(true, { url: data.avatar_url }, "Avatar updated."),
        );
    } catch (error) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Avatar upload failed"));
    }
  }

  @HandleExceptions()
  public static async get(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `
    SELECT
      id,
      name,
      size,
      url,
      type,
      created_at
    FROM task_attachments
    WHERE task_id = $1;
  `;

    const result = await db.query(q, [req.params.id]);

    for (const item of result.rows) {
      item.size = humanFileSize(item.size);
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getByProjectId(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { size, offset } = this.toPaginationOptions(req.query, "name");

    const q = `
              SELECT ROW_TO_JSON(rec) AS attachments
              FROM (SELECT COUNT(*)                          AS total,
                          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                            FROM (SELECT task_attachments.id,
                                        task_attachments.name,
                                        CONCAT((SELECT key FROM projects WHERE id = task_attachments.project_id), '-',
                                                (SELECT task_no FROM tasks WHERE id = task_attachments.task_id)) AS task_key,
                                        size,
                                        CONCAT($2::TEXT, '/', task_attachments.team_id, '/', task_attachments.project_id, '/',task_attachments.id,'.',type)                                                            AS url,
                                        task_attachments.type,
                                        task_attachments.created_at,
                                        t.name                                                                  AS task_name,
                                        (SELECT name FROM users WHERE id = task_attachments.uploaded_by)        AS uploader_name
                                  FROM task_attachments
                                          LEFT JOIN tasks t ON task_attachments.task_id = t.id
                                  WHERE task_attachments.project_id = $1
                                  ORDER BY created_at DESC
                          LIMIT $3 OFFSET $4)t) AS data
                    FROM task_attachments
                            LEFT JOIN tasks t ON task_attachments.task_id = t.id
                    WHERE task_attachments.project_id = $1) rec;
    `;
    const result = await db.query(q, [
      req.params.id,
      `${getStorageUrl()}/${getRootDir()}`,
      size,
      offset,
    ]);
    const [data] = result.rows;

    for (const item of data?.attachments.data || [])
      item.size = humanFileSize(item.size);

    return res
      .status(200)
      .send(
        new ServerResponse(
          true,
          data?.attachments || this.paginatedDatasetDefaultStruct,
        ),
      );
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `DELETE
               FROM task_attachments
               WHERE id = $1
               RETURNING team_id, project_id, id, type;`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;

    if (data) {
      const key = `task_mate/task_media/task_${data.id}`;
      await deleteFileFromCloudinary(key);
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async download(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `
    SELECT id, name FROM task_attachments WHERE id = $1;
    `;

    const result = await db.query(q, [req.query.id]);
    const [data] = result.rows;

    if (!data) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "File not found"));
    }

    const key = `task_mate/task_media/task_${data.id}`;
    // ⏳ Signed URL (expires in 5 minutes)
    const downloadUrl = await createCloudinaryPresignedUrl(key, data.name);
    return res.status(200).send(
      new ServerResponse(true, {
        url: downloadUrl,
        fileName: data.name,
      }),
    );
  }
}
