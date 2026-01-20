import { NextFunction } from "express";
import sharp from "sharp";

import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";

export default async function (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction,
) {
  if (!req.file) return next();

  try {
    const out = await sharp(req.file.buffer).webp({ quality: 50 }).toBuffer();

    // overwrite payload for controller
    req.body.buffer = out;
    req.body.type = "webp";

    return next();
  } catch (error) {
    return res
      .status(200)
      .send(new ServerResponse(false, null, "Upload failed"));
  }
}
