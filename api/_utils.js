export function enforceMethod(request, response, expectedMethod) {
  if (request.method === expectedMethod) {
    return true;
  }

  response.statusCode = 405;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      error: `Method ${request.method || "UNKNOWN"} not allowed.`
    })
  );
  return false;
}
