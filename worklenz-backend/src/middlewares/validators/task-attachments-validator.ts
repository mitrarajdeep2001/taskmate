import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getFreePlanSettings, getUsedStorage } from "../../shared/paddle-utils";
import { megabytesToBytes } from "../../shared/utils";

export default async function (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction,
): Promise<IWorkLenzResponse | void> {

  // 🔴 multer places file here
  const file = req.file;
  const { project_id } = req.body;

  if (!file || !project_id) {
    return res
      .status(200)
      .send(new ServerResponse(false, null, "Upload failed"));
  }

  const fileName = file.originalname;
  const size = file.size;

  // 🔐 Subscription storage limit check
  if (req.user?.subscription_status === "free" && req.user?.owner_id) {
    const limits = await getFreePlanSettings();
    const usedStorage = await getUsedStorage(req.user.owner_id);

    if (
      parseInt(usedStorage) + size >
      megabytesToBytes(parseInt(limits.free_tier_storage))
    ) {
      return res.status(200).send(
        new ServerResponse(
          false,
          [],
          `Sorry, the free plan cannot exceed ${limits.free_tier_storage}MB of storage.`,
        ),
      );
    }
  }

  // ✅ Normalize fields for controller
  req.body.file_name = fileName;
  req.body.size = size;
  req.body.type = fileName.split(".").pop()?.toLowerCase();
  req.body.buffer = file.buffer;
  req.body.task_id = req.body.task_id || null;

  return next();
}
