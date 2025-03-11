import { DateTime } from "luxon";
import { BaseModel, column } from "@adonisjs/lucid/orm";

export default class File extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;

  @column()
  declare cid: String;

  @column()
  declare name: String;

  @column()
  declare slug: String;

  @column()
  declare size: Number;

  @column()
  declare extension: String;

  @column()
  declare type: String;

  @column()
  declare category: String;
}
