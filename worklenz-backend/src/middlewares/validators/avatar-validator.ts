import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";

export default function (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction,
): IWorkLenzResponse | void {
  const file = req.file;

  if (!file) {
    return res
      .status(200)
      .send(new ServerResponse(false, null, "Upload failed"));
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];

  if (!allowedTypes.includes(file.mimetype)) {
    return res
      .status(200)
      .send(new ServerResponse(false, null, "Invalid file type"));
  }

  // attach metadata for next middlewares
  req.body.type = file.mimetype.split("/")[1];
  req.body.size = file.size;

  return next();
}
