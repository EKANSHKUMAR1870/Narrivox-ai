import { handleSession } from "../../server.js";
import { enforceMethod } from "../_utils.js";

export default async function handler(request, response) {
  if (!enforceMethod(request, response, "GET")) {
    return;
  }

  await handleSession(request, response);
}
