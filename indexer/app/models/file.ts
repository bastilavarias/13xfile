import { DateTime } from "luxon";
import {
  BaseModel,
  column,
  computed,
  hasMany,
  hasOne,
} from "@adonisjs/lucid/orm";
import FileActivity from "#models/file_activity";
import * as relations from "@adonisjs/lucid/types/relations";

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
  declare description: String;

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

  @hasMany(() => FileActivity, {
    onQuery: (query) => query.where("action", "view"),
  })
  declare views: relations.HasMany<typeof FileActivity>;

  @hasMany(() => FileActivity, {
    onQuery: (query) => query.where("action", "share"),
  })
  declare shares: relations.HasMany<typeof FileActivity>;

  @hasMany(() => FileActivity, {
    onQuery: (query) => query.where("action", "download"),
  })
  declare downloads: relations.HasMany<typeof FileActivity>;
}
