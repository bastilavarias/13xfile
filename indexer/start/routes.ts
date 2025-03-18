/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from "@adonisjs/core/services/router";
const FilesController = () => import("#controllers/files_controller");
const IPFSController = () => import("#controllers/ipfs_controller");

router
  .group(() => {
    router
      .group(() => {
        router.get("/", [FilesController, "index"]);
        router.post("/", [FilesController, "create"]);
        router.get("/record/:slug", [FilesController, "getBySlug"]);
        router.get("/category", [FilesController, "getCategory"]);
      })
      .prefix("/file");

    router
      .group(() => {
        router.get("/download/:cid", [IPFSController, "download"]);
      })
      .prefix("/ipfs");
  })
  .prefix("/api");
