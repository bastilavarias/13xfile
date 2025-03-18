import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "files";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.string("cid");
      table.string("slug");
      table.string("name");
      table.text("description");
      table.integer("size");
      table.string("extension");
      table.string("type");
      table.string("category");
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
