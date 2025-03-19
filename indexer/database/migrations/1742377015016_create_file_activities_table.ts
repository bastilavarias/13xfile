import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "file_activities";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("file_id")
        .unsigned()
        .references("id")
        .inTable("files")
        .onDelete("CASCADE");
      table.enum("action", ["view", "share", "download"]).notNullable(); // Activity action
      table.timestamp("created_at");
      table.timestamp("updated_at");
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
