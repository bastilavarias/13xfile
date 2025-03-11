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

router.get("files", [FilesController, "index"]);
router.post("files", [FilesController, "create"]);
