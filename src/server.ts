import { createApp } from './app';
import { initializeDatabase, openDatabase } from './db/database';

const db = openDatabase();
initializeDatabase(db);

const port = Number(process.env.PORT ?? 3000);
createApp(db).listen(port, () => {
  process.stdout.write(`Leave management API listening on port ${port}\n`);
});
