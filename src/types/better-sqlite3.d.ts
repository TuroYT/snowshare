declare module 'better-sqlite3' {
  namespace DatabaseNS {
    interface Options {
      readonly?: boolean;
      fileMustExist?: boolean;
      timeout?: number;
      verbose?: (message?: any, ...optionalParams: any[]) => void;
    }
  }
  class Database {
    constructor(filename?: string, options?: DatabaseNS.Options);
    close(): void;
  }
  export = Database;
}
