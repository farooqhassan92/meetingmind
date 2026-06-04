import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const uploadRouter = {
  meetingAudio: f({
    audio: {
      maxFileSize: "128MB",
      maxFileCount: 1
    }
  })
    .middleware(async () => {
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      return {
        name: file.name,
        url: file.ufsUrl
      };
    })
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
