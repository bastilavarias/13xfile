import { DateTime } from "luxon";
import { BaseModel, column } from "@adonisjs/lucid/orm";

export default class FileActivity extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare fileId: number;

  @column()
  declare action: String;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;
}
