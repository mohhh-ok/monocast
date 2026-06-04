import { promises as fs } from "node:fs";
import { createFileRoute } from "@tanstack/react-router";
import { dataPath } from "@/lib/data-dir";

const ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SEG_PATTERN = /^seg-\d{3}\.wav$/;

export const Route = createFileRoute("/api/audio/$id/$seg")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!ID_PATTERN.test(params.id) || !SEG_PATTERN.test(params.seg)) {
          return new Response("not found", { status: 404 });
        }
        const filePath = dataPath("audio", params.id, params.seg);
        try {
          const [stat, buf] = await Promise.all([
            fs.stat(filePath),
            fs.readFile(filePath),
          ]);
          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": "audio/wav",
              "Content-Length": String(stat.size),
              "Last-Modified": stat.mtime.toUTCString(),
              "Cache-Control": "no-cache",
            },
          });
        } catch (err) {
          if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
            return new Response("not found", { status: 404 });
          }
          throw err;
        }
      },
    },
  },
});
