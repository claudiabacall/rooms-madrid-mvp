import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, relative, sep } from "node:path";
import dotenv from "dotenv";
import { geocodeMadridAddress } from "./lib/geocode.mjs";

dotenv.config({ path: ".env.local" });

const port = Number(process.env.PORT || 4173);
const root = process.cwd();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml"
};

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer
    .concat(chunks)
    .toString("utf8");

  if (!raw) return {};

  return JSON.parse(raw);
}

createServer(async (request, response) => {
  try {
    const url = new URL(
      request.url,
      "http://localhost"
    );

    if (url.pathname === "/api/geocode") {
      if (request.method !== "POST") {
        response.writeHead(405, {
          "Content-Type":
            "application/json; charset=utf-8",
          Allow: "POST"
        });

        response.end(
          JSON.stringify({
            error: "Method not allowed"
          })
        );

        return;
      }

      const body =
        await readJsonBody(request);

      const address =
        String(body.address || "").trim();

      if (address.length < 5 || address.length > 200) {
        response.writeHead(400, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

        response.end(
          JSON.stringify({
            error:
              "Introduce una dirección válida"
          })
        );

        return;
      }

      try {
        const result =
          await geocodeMadridAddress(address);

        if (!result) {
          response.writeHead(404, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          response.end(
            JSON.stringify({
              error:
                "No hemos podido localizar esa dirección"
            })
          );

          return;
        }

        response.writeHead(200, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

        response.end(
          JSON.stringify(result)
        );

        return;
      } catch (error) {
        console.error(
          "Rooms geocode error:",
          error
        );

        response.writeHead(500, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

        response.end(
          JSON.stringify({
            error:
              error?.message ||
              "No hemos podido comprobar la dirección"
          })
        );

        return;
      }
    }

    // Serve only public frontend resources. Never expose local configuration,
    // migration files, scripts, source maps, or installed dependencies.
    const pathname = decodeURIComponent(url.pathname);
    const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const allowed = requested === "index.html" || requested.startsWith("assets/");
    const segments = requested.split(/[\\/]+/);
    if (!allowed || segments.some(part => !part || part === "." || part === ".." || part.startsWith("."))) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Archivo no encontrado");
      return;
    }
    const filePath = resolve(root, requested);
    const rel = relative(root, filePath);
    if (rel.startsWith(".." + sep) || rel === ".." || rel.startsWith(sep)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Archivo no encontrado");
      return;
    }
    if (!(await stat(filePath)).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Archivo no encontrado");
      return;
    }

    const body =
      await readFile(filePath);

    response.writeHead(200, {
      "Content-Type":
        types[
          extname(filePath).toLowerCase()
        ] ||
        "application/octet-stream"
    });

    response.end(body);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(
        "Rooms server error:",
        error
      );
    }

    response.writeHead(
      error?.code === "ENOENT"
        ? 404
        : 500,
      {
        "Content-Type":
          "text/plain; charset=utf-8"
      }
    );

    response.end(
      error?.code === "ENOENT"
        ? "Archivo no encontrado"
        : "Error interno del servidor"
    );
  }
}).listen(
  port,
  "127.0.0.1",
  () => {
    console.log(
      `Rooms disponible en http://127.0.0.1:${port}`
    );
  }
);
