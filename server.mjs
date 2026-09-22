import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
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

      if (address.length < 5) {
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

    const pathname =
      decodeURIComponent(url.pathname);

    const requested =
      pathname === "/"
        ? "index.html"
        : pathname.replace(/^\/+/, "");

    const safePath =
      normalize(requested)
        .replace(
          /^(\.\.(\/|\\|$))+/,
          ""
        );

    let filePath =
      join(root, safePath);

    if (
      (await stat(filePath)).isDirectory()
    ) {
      filePath =
        join(filePath, "index.html");
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
    console.error(error);

    response.writeHead(404, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    response.end(
      "Archivo no encontrado"
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
