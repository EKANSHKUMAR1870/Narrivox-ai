import { handleLogout } from "../../server.js";
import { enforceMethod } from "../_utils.js";

export default async function handler(request, response) {
  if (!enforceMethod(request, response, "POST")) {
    return;
  }

  await handleLogout(request, response);
}
